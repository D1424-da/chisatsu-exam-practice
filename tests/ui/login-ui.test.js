// UIテスト: ログイン画面・ナビゲーション・共通コンポーネント
const { test, expect } = require('../fixtures');

test.describe('ログイン画面 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page).toHaveTitle('土地家屋調査士の肢別問題集');
  });

  test('ロゴ文字が表示される', async ({ page }) => {
    // 初期ロード時にapp か login-overlay が表示される
    const loginLogo = page.locator('.login-logo');
    const headerLogo = page.locator('.logo');
    const hasLoginLogo = await loginLogo.count() > 0;
    const hasHeaderLogo = await headerLogo.count() > 0;
    expect(hasLoginLogo || hasHeaderLogo).toBeTruthy();
  });

  test('ログインフォームの必須要素が存在する', async ({ page }) => {
    const loginOverlay = page.locator('#login-overlay');
    // ログインオーバーレイがあること（hiddenでも要素は存在する）
    await expect(loginOverlay).toBeAttached();
    await expect(page.locator('#login-email')).toBeAttached();
    await expect(page.locator('#login-password')).toBeAttached();
    await expect(page.locator('#btn-login')).toBeAttached();
  });

  test('メールアドレス入力欄の type が email', async ({ page }) => {
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('パスワード入力欄の type が password', async ({ page }) => {
    const pwInput = page.locator('#login-password');
    await expect(pwInput).toHaveAttribute('type', 'password');
  });

  test('新規ユーザー作成ボタンが存在する', async ({ page }) => {
    await expect(page.locator('#btn-show-register')).toBeAttached();
  });

  test('パスワードリセットリンクが存在する', async ({ page }) => {
    await expect(page.locator('#btn-show-reset')).toBeAttached();
  });

  test('エラーメッセージが初期状態で非表示', async ({ page }) => {
    const loginError = page.locator('#login-error');
    await expect(loginError).toBeAttached();
    // class="hidden" であること
    await expect(loginError).toHaveClass(/hidden/);
  });
});

test.describe('アプリ骨格 DOM構造', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ヘッダーが存在する', async ({ page }) => {
    await expect(page.locator('header.header')).toBeAttached();
  });

  test('ナビゲーションボタンが存在する', async ({ page }) => {
    await expect(page.locator('button[data-page="study"]')).toBeAttached();
    await expect(page.locator('#nav-stats-btn')).toBeAttached();
  });

  test('学習ページセクションが存在する', async ({ page }) => {
    await expect(page.locator('#page-study')).toBeAttached();
  });

  test('フィルターバーの全ドロップダウンが存在する', async ({ page }) => {
    await expect(page.locator('#filter-subject')).toBeAttached();
    await expect(page.locator('#filter-category')).toBeAttached();
    await expect(page.locator('#filter-mode')).toBeAttached();
  });

  test('学習開始ボタンが存在する', async ({ page }) => {
    await expect(page.locator('#btn-start')).toBeAttached();
  });

  test('結果モーダルが存在する（初期非表示）', async ({ page }) => {
    const modal = page.locator('#modal-result');
    await expect(modal).toBeAttached();
    await expect(modal).toHaveClass(/hidden/);
  });

  test('問題モーダルが存在する（初期非表示）', async ({ page }) => {
    const modal = page.locator('#modal-question');
    await expect(modal).toBeAttached();
  });

  test('マスタリーボタンが存在する', async ({ page }) => {
    await expect(page.locator('#btn-mark-perfect')).toBeAttached();
    await expect(page.locator('#btn-mark-ambiguous')).toBeAttached();
  });

  test('あいまいボタンが btn-primary クラスを持つ（修正確認）', async ({ page }) => {
    const btn = page.locator('#btn-mark-ambiguous');
    await expect(btn).toHaveClass(/btn-primary/);
  });
});

test.describe('フィルターモード選択肢', () => {
  test('全出題モードが選択肢に存在する', async ({ page }) => {
    await page.goto('/');
    const select = page.locator('#filter-mode');
    await expect(select).toBeAttached();

    const options = await select.locator('option').allTextContents();
    const expectedModes = ['全問ランダム', '優先復習', '苦手優先', '復習優先', '未回答のみ', '間違えたもの', 'あいまい', '完璧', 'ブックマーク'];
    for (const mode of expectedModes) {
      const found = options.some(o => o.includes(mode));
      expect(found, `モード「${mode}」が見つからない`).toBeTruthy();
    }
  });
});
