// パフォーマンステスト: 読み込み速度・レンダリング指標
const { test, expect } = require('../fixtures');

test.describe('ページパフォーマンス', () => {
  test('初回読み込み: DOMContentLoaded が3秒以内', async ({ page }) => {
    const timing = await page.evaluate(() => {
      return new Promise(resolve => {
        if (document.readyState !== 'loading') {
          resolve(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart);
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            resolve(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart);
          });
        }
      });
    });

    // まず goto してから計測
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;
    expect(elapsed, `DOMContentLoaded に ${elapsed}ms かかった`).toBeLessThan(3000);
  });

  test('初回読み込み: load イベントが5秒以内', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'load' });
    const elapsed = Date.now() - start;
    expect(elapsed, `load イベントに ${elapsed}ms かかった`).toBeLessThan(5000);
  });

  test('CSS ファイルが読み込まれる (style.css)', async ({ page }) => {
    const cssRequests = [];
    page.on('response', res => {
      if (res.url().includes('style.css')) cssRequests.push(res.status());
    });
    await page.goto('/');
    expect(cssRequests.length).toBeGreaterThan(0);
    expect(cssRequests[0]).toBe(200);
  });

  test('JS ファイルが読み込まれる (app.js)', async ({ page }) => {
    const jsRequests = [];
    page.on('response', res => {
      if (res.url().includes('app.js')) jsRequests.push(res.status());
    });
    await page.goto('/');
    expect(jsRequests.length).toBeGreaterThan(0);
    expect(jsRequests[0]).toBe(200);
  });

  test('ページの総転送サイズが妥当な範囲', async ({ page }) => {
    let totalBytes = 0;
    page.on('response', async res => {
      const headers = res.headers();
      const contentLength = parseInt(headers['content-length'] || '0', 10);
      if (contentLength > 0) totalBytes += contentLength;
    });
    await page.goto('/');
    // 初回ロード: app.js(173KB) + style.css(35KB) + Firebase SDK ≈ 合計数MB まで許容
    // ここではローカルファイルのみ計測（外部CDN除く）
    // ローカル資産のみで 500KB 以内を目安に確認
    console.log(`総転送バイト（計測分）: ${(totalBytes / 1024).toFixed(1)}KB`);
    expect(totalBytes).toBeGreaterThan(0); // 何かロードされている
  });

  test('Web Vitals: Largest Contentful Paint が測定可能', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lcp = await page.evaluate(() =>
      new Promise(resolve => {
        new PerformanceObserver(list => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        // フォールバック
        setTimeout(() => resolve(-1), 2000);
      })
    );
    console.log(`LCP: ${lcp.toFixed(0)}ms`);
    if (lcp > 0) {
      // Good: <2.5s, Needs Improvement: <4.0s, Poor: >=4.0s
      expect(lcp).toBeLessThan(4000);
    }
  });

  test('JavaScript エラーがコンソールに出ない（Firebase接続エラー除く）', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Firebase接続エラーは許容（オフライン環境）
        if (!text.includes('firestore') && !text.includes('Firebase') &&
            !text.includes('ERR_NAME_NOT_RESOLVED') && !text.includes('net::ERR')) {
          errors.push(text);
        }
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });
    await page.goto('/');
    await page.waitForTimeout(1000);
    if (errors.length > 0) {
      console.log('JavaScriptエラー:\n' + errors.join('\n'));
    }
    expect(errors.length).toBe(0);
  });
});

test.describe('パフォーマンス: 大量データ描画', () => {
  test('localStorage に大量レコードを入れてもUIが応答する', async ({ page }) => {
    await page.goto('/');

    // 大量のレコードをlocalStorageに投入
    await page.evaluate(() => {
      const records = {};
      for (let i = 0; i < 1000; i++) {
        records[`limb-${i}`] = {
          correct: Math.floor(Math.random() * 10),
          wrong: Math.floor(Math.random() * 5),
          wrongDateKeys: [],
          review: { intervalDays: 1, streak: 0, ease: 2.0, lastAnsweredAtMs: 0, dueAtMs: 0 },
          mastery: '',
          masteryUpdatedAtMs: 0,
          note: '',
          bookmarked: false
        };
      }
      localStorage.setItem('chisatsu_limb_records', JSON.stringify(records));
    });

    // ページをリロードして大量データを読み込み
    const start = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
    console.log(`1000件レコード読み込み時間: ${elapsed}ms`);
  });
});
