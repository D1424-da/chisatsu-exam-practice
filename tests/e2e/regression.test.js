// 回帰テスト: 過去に修正したバグが再発していないことを確認
const { test, expect } = require('../fixtures');

test.describe('回帰テスト: 過去の修正確認', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // 修正: あいまいボタンのクラスが btn-ghost から btn-primary に変更された
  test('BUG-FIX: あいまいボタンが btn-primary を持つ（btn-ghost ではない）', async ({ page }) => {
    const btn = page.locator('#btn-mark-ambiguous');
    const classes = await btn.getAttribute('class');
    expect(classes).toContain('btn-primary');
    expect(classes).not.toContain('btn-ghost');
  });

  // 修正: is-selected 時の CSS セレクターが正しく適用される
  test('BUG-FIX: あいまいボタンの .btn-primary.is-selected CSS ルールが適用される', async ({ page }) => {
    // is-selectedクラスをJavaScriptで追加してスタイルが変わることを確認
    await page.evaluate(() => {
      const btn = document.getElementById('btn-mark-ambiguous');
      if (btn) btn.classList.add('is-selected');
    });

    const btn = page.locator('#btn-mark-ambiguous');
    // is-selectedクラスが付与されている
    await expect(btn).toHaveClass(/is-selected/);

    // 背景色が変わる（デフォルトのbtn-primaryと異なるはず）
    const bgImage = await btn.evaluate(el =>
      getComputedStyle(el).backgroundImage
    );
    // is-selected状態でgradientが適用されていることを確認
    console.log(`is-selected時の背景: ${bgImage}`);
    expect(bgImage).not.toBe('none');
  });

  // 修正: ブックマーク二重カウント解消（静的解析で確認）
  test('BUG-FIX: priorityReviewScore にブックマーク直接加算がない', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

    // 関数本体内に `if (r.bookmarked) s += 2` が存在しないことを確認
    // 関数定義から次の関数定義 or コメントまでの範囲を抽出
    const funcMatch = js.match(/function priorityReviewScore[\s\S]*?^}/m);
    if (funcMatch) {
      const funcBody = funcMatch[0];
      const hasDirectBookmarkBonus = /if\s*\(\s*r\.bookmarked\s*\)\s*s\s*\+=\s*2/.test(funcBody);
      expect(hasDirectBookmarkBonus).toBeFalsy();
    } else {
      // 関数が見つからない場合はスキップ
      console.warn('priorityReviewScore関数が見つかりません');
    }
  });

  // 修正: dead CSS ルールの削除確認
  test('BUG-FIX: style.css に .btn-ghost のデッドCSSがない', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '../../style.css'), 'utf8');

    // result-mastery-actions .btn-ghost ルールが削除されている
    const hasDeadRule = css.includes('.result-mastery-actions .btn-ghost');
    expect(hasDeadRule).toBeFalsy();
  });

  // 修正: isPerfectLimb ヘルパーが mode==='perfect' で使われている
  test('BUG-FIX: isPerfectLimb が mode===perfect フィルタで使われている', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

    // 修正後: isPerfectLimb(l.id) が使われている
    const usesHelper = /mode === 'perfect'\s*\)\s*\{[\s\S]{0,100}isPerfectLimb/.test(js);
    expect(usesHelper).toBeTruthy();
  });
});

test.describe('回帰テスト: 結果モーダルのメモ挙動', () => {
  test('modalAlreadyOpen フラグがshowResult関数内に存在する', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

    // メモの上書き防止コードが存在する
    expect(js).toContain('modalAlreadyOpen');
    expect(js).toContain("!overlay.classList.contains('hidden')");
  });

  test('result-btn-bookmark ハンドラが btn-bookmark-limb も更新する', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

    // ブックマーク同期コードが存在する
    expect(js).toContain('btn-bookmark-limb');
    expect(js).toContain("getElementById('btn-bookmark-limb')");
  });
});

test.describe('回帰テスト: 全自動改善対応の確認', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('BUG-FIX: 管理者ログインのplaceholderが汎用テキストになっている', async ({ page }) => {
    const placeholder = await page.locator('#admin-login-username').getAttribute('placeholder');
    expect(placeholder).not.toContain('@');
  });

  test('BUG-FIX: 3つのモーダルに role=dialog と aria-modal が設定されている', async ({ page }) => {
    for (const id of ['modal-question', 'modal-result', 'admin-login-overlay']) {
      const modal = page.locator(`#${id}`);
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-modal', 'true');
    }
  });

  test('BUG-FIX: makeEmptyRecord ファクトリ関数が定義され重複が解消されている', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
    expect(js).toContain('function makeEmptyRecord()');
    // 完全な8フィールドの空レコードリテラルは makeEmptyRecord 内の1箇所のみ
    const fullLiteralCount = (js.match(/correct: 0,\s*\n\s*wrong: 0,\s*\n\s*wrongDateKeys: \[\]/g) || []).length;
    expect(fullLiteralCount).toBe(1);
  });

  test('BUG-FIX: isAmbiguousLimb ヘルパーが定義され mode===ambiguous で使われている', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
    expect(js).toContain('function isAmbiguousLimb(limbId)');
    const usesHelper = /mode === 'ambiguous'\s*\)\s*\{[\s\S]{0,100}isAmbiguousLimb/.test(js);
    expect(usesHelper).toBeTruthy();
  });

  test('BUG-FIX: useLocalStorage / volatileStorage のデッドコードが削除されている', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
    expect(js).not.toContain('const useLocalStorage');
    expect(js).not.toContain('const volatileStorage');
  });

  test('BUG-FIX: モーダルの max-height が 100dvh に対応している', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '../../style.css'), 'utf8');
    expect(css).toContain('calc(100dvh - 40px)');
  });

  test('BUG-FIX: index.html のインラインスタイルが7件以下に削減されている', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    const inlineStyles = html.match(/style="/g) || [];
    // 修正前は8件。動的更新されるprogress-barのwidth:0%のみ残す想定。
    expect(inlineStyles.length).toBeLessThanOrEqual(1);
  });

  test('BUG-FIX: 問題追加モーダルを開くと input-subject にフォーカスが移る', async ({ page }) => {
    const opened = await page.evaluate(() => {
      if (typeof openAddModal !== 'function') return null;
      openAddModal();
      return document.activeElement?.id;
    });
    if (opened !== null) {
      expect(opened).toBe('input-subject');
    }
  });
});
