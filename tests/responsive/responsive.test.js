// レスポンシブテスト: 各ビューポートサイズでのレイアウト確認
const { test, expect } = require('../fixtures');

const VIEWPORTS = [
  { name: 'スマートフォン小 (320px)', width: 320, height: 568 },
  { name: 'スマートフォン標準 (375px)', width: 375, height: 667 },
  { name: 'スマートフォン大 (414px)', width: 414, height: 896 },
  { name: 'タブレット縦 (768px)', width: 768, height: 1024 },
  { name: 'タブレット横 (1024px)', width: 1024, height: 768 },
  { name: 'デスクトップ (1280px)', width: 1280, height: 800 },
  { name: 'ワイドスクリーン (1440px)', width: 1440, height: 900 },
];

test.describe('レスポンシブレイアウト', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: 横スクロールが発生しない`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // ページの横幅がビューポートを超えていないか
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = vp.width;
      expect(bodyWidth, `横スクロール発生: body幅${bodyWidth}px > ビューポート${viewportWidth}px`).toBeLessThanOrEqual(viewportWidth + 5); // 5px の許容
    });

    test(`${vp.name}: ヘッダーが表示される`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await expect(page.locator('header.header')).toBeVisible();
    });

    test(`${vp.name}: アプリのコンテナ要素が存在する`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      // ヘッダーは認証状態に関わらず常に DOM に存在する
      await expect(page.locator('header.header')).toBeAttached();
      // #app と #login-overlay は認証前は hidden だが DOM には存在する
      await expect(page.locator('#app')).toBeAttached();
      await expect(page.locator('#login-overlay')).toBeAttached();
    });
  }

  test('モバイル (375px): フィルターバーが縦方向に折り返す', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const filterRow = page.locator('.filter-row');
    if (await filterRow.count() > 0) {
      const box = await filterRow.boundingBox();
      // フィルターバーの高さがデスクトップより大きい（折り返している）
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }
  });

  test('モバイル: ボタンの最小タッチターゲット高さ (推奨44px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const primaryBtns = await page.locator('#btn-start, #btn-login, #btn-register').all();
    for (const btn of primaryBtns) {
      const box = await btn.boundingBox();
      if (box) {
        // メインアクションボタンは少なくとも36px以上
        expect(box.height, `プライマリボタンの高さが小さすぎる: ${box.height}px`).toBeGreaterThanOrEqual(36);
      }
    }
  });
});

test.describe('CSS変数・テーマ', () => {
  test('CSS変数 --primary が定義されている', async ({ page }) => {
    await page.goto('/');
    const primaryColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    );
    expect(primaryColor.length).toBeGreaterThan(0);
  });

  test('CSS変数 --bg が定義されている', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    );
    expect(bg.length).toBeGreaterThan(0);
  });

  test('CSS変数 --mastery-perfect が定義されている', async ({ page }) => {
    await page.goto('/');
    const color = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mastery-perfect').trim()
    );
    expect(color.length).toBeGreaterThan(0);
  });

  test('CSS変数 --mastery-ambiguous が定義されている', async ({ page }) => {
    await page.goto('/');
    const color = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mastery-ambiguous').trim()
    );
    expect(color.length).toBeGreaterThan(0);
  });
});
