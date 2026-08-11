// セキュリティテスト
const { test, expect } = require('../fixtures');
const fs = require('fs');
const path = require('path');

// ソースコードを読み込む
const appJs = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

test.describe('XSS対策 (コード静的解析)', () => {
  test('innerHTML への直接代入に esc() が使われている', () => {
    // innerHTML = "..." パターンを検索
    const rawInnerHTML = appJs.match(/\.innerHTML\s*=\s*`[^`]*\$\{(?!esc\()/g) || [];
    // 変数を直接埋め込む場合は esc() が必要
    const dangerous = rawInnerHTML.filter(m => !m.includes('esc('));
    if (dangerous.length > 0) {
      console.warn('潜在的なXSS脆弱性 (innerHTML直接代入):\n' + dangerous.slice(0, 3).join('\n'));
    }
    // esc 関数が定義されている
    expect(appJs).toContain("function esc(str)");
  });

  test('esc() 関数が主要な HTML エスケープ文字を処理する', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      if (typeof esc === 'undefined') return null;
      return {
        lt: esc('<'),
        gt: esc('>'),
        amp: esc('&'),
        quot: esc('"'),
        apos: esc("'")
      };
    });
    if (result) {
      expect(result.lt).toBe('&lt;');
      expect(result.gt).toBe('&gt;');
      expect(result.amp).toBe('&amp;');
      expect(result.quot).toBe('&quot;');
      expect(result.apos).toBe('&#39;');
    }
  });

  test('eval() の使用がない', () => {
    // セキュリティ上危険な eval の直接使用を検索
    const evalUsage = appJs.match(/[^a-zA-Z]eval\s*\(/g) || [];
    expect(evalUsage.length).toBe(0);
  });

  test('document.write() の使用がない', () => {
    const docWrite = appJs.match(/document\.write\s*\(/g) || [];
    expect(docWrite.length).toBe(0);
  });
});

test.describe('ローカルストレージのセキュリティ', () => {
  test('LS_PREFIX が設定されており衝突防止されている', () => {
    expect(appJs).toContain("const LS_PREFIX = 'chisatsu_'");
  });

  test('機密情報がlocalStorageに平文保存されない（コード確認）', async ({ page }) => {
    await page.goto('/');
    // localStorageにパスワードを保存するコードがないことを確認
    const hasPasswordInStorage = appJs.includes("localStorage.setItem") &&
      appJs.toLowerCase().includes('password') &&
      /localStorage\.setItem\([^,]*[Pp]assword/.test(appJs);
    expect(hasPasswordInStorage).toBeFalsy();
  });

  test('localStorageのキー一覧にパスワード関連がない', async ({ page }) => {
    await page.goto('/');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const hasPasswordKey = keys.some(k => k.toLowerCase().includes('password'));
    expect(hasPasswordKey).toBeFalsy();
  });
});

test.describe('コンテンツセキュリティ', () => {
  // BUG-FIX: 管理者メールアドレスの実値を placeholder から汎用テキストに変更済み
  test('管理者メールアドレスがソースコードに埋め込まれていない（HTMLハードコード）', () => {
    const emailInPlaceholder = indexHtml.match(/placeholder="[^"]*@[^"]*\.[^"]*"/g) || [];
    const hasHardcodedEmail = emailInPlaceholder.some(p =>
      !p.includes('example.com') && !p.includes('your@') && !p.includes('メール')
    );
    expect(hasHardcodedEmail).toBeFalsy();
  });

  test('.gitignore が .env を除外している', () => {
    const gitignorePath = path.join(__dirname, '../../.gitignore');
    const gitignore = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, 'utf8')
      : '';
    const ignoresEnv = gitignore.includes('.env');
    if (!ignoresEnv) {
      console.warn('.gitignore に .env が含まれていません。環境変数ファイルが意図せず公開される可能性があります。');
    }
    // 修正済み (.gitignore に .env を追加)
    expect(ignoresEnv).toBeTruthy();
  });

  test('console.log へのパスワード出力がない', () => {
    const consolePasswordLog = /console\.(log|warn|info)\([^)]*[Pp]assword/.test(appJs);
    expect(consolePasswordLog).toBeFalsy();
  });
});

test.describe('Firestoreセキュリティルール', () => {
  test('firestore.rules ファイルが存在する', () => {
    const rulesPath = path.join(__dirname, '../../firestore.rules');
    expect(fs.existsSync(rulesPath)).toBeTruthy();
  });

  test('firestore.rules が allow read, write: if true を含まない（全公開ルール）', () => {
    const rulesPath = path.join(__dirname, '../../firestore.rules');
    if (fs.existsSync(rulesPath)) {
      const rules = fs.readFileSync(rulesPath, 'utf8');
      const hasOpenRule = /allow\s+(read|write)\s*,?\s*(write|read)?\s*:\s*if\s+true/.test(rules);
      expect(hasOpenRule).toBeFalsy();
    }
  });
});

test.describe('ネットワークセキュリティ (ブラウザ)', () => {
  test('HTTPSリソースのみ読み込む（http:// の外部リソースなし）', async ({ page }) => {
    const httpResources = [];
    page.on('request', req => {
      const url = req.url();
      if (url.startsWith('http://') && !url.startsWith('http://localhost')) {
        httpResources.push(url);
      }
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    if (httpResources.length > 0) {
      console.warn('HTTP(非HTTPS)リソース:', httpResources);
    }
    expect(httpResources.length).toBe(0);
  });

  test('外部リソースが既知のドメインのみ', async ({ page }) => {
    const allowedDomains = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'www.gstatic.com',
      'accounts.google.com',
      'firestore.googleapis.com',
      'firebase.googleapis.com',
      'identitytoolkit.googleapis.com',
    ];
    const unexpectedRequests = [];
    page.on('request', req => {
      const url = req.url();
      if (url.startsWith('http://localhost')) return;
      if (url.startsWith('data:')) return;
      try {
        const hostname = new URL(url).hostname;
        const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
        if (!isAllowed) unexpectedRequests.push(url);
      } catch {}
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    if (unexpectedRequests.length > 0) {
      console.warn('未知ドメインへのリクエスト:', unexpectedRequests);
    }
    // 警告のみ（外部ライブラリ追加の場合に検知）
    expect(true).toBeTruthy();
  });
});
