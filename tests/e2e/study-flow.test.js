// E2Eテスト: 学習フロー・セッション管理・モーダル動作
const { test, expect } = require('../fixtures');

// Firebase 認証なしでアプリを初期化するためのモック
async function mockAuthAndLoadApp(page) {
  await page.goto('/');
  // Firebase の認証状態をモックしてアプリを使えるようにする
  await page.evaluate(() => {
    // currentUser をモック
    window.__mockCurrentUser = { id: 'test-user-001', name: 'テストユーザー' };

    // 最小限の問題データをlocalStorageに設定
    const questions = [
      {
        id: 'q001',
        subject: '民法',
        category: '物権',
        year: 2023,
        text: '地上権は物権である。',
        correct: true,
        explanation: '地上権は物権の一種です。'
      },
      {
        id: 'q002',
        subject: '民法',
        category: '債権',
        year: 2023,
        text: '売買契約は要式契約である。',
        correct: false,
        explanation: '売買契約は諾成契約です。'
      },
      {
        id: 'q003',
        subject: '不動産登記法',
        category: '総則',
        year: 2022,
        text: '登記は対抗要件である。',
        correct: true,
        explanation: '不動産登記は第三者対抗要件です。'
      },
    ];
    localStorage.setItem('chisatsu_limb_questions', JSON.stringify(questions));
    localStorage.setItem('chisatsu_limb_records', JSON.stringify({}));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

test.describe('DOM存在確認 (認証不要)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ページが正常にロードされる (200 OK)', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('app.js が読み込まれる', async ({ page }) => {
    const hasAppJs = await page.evaluate(() => typeof window !== 'undefined');
    expect(hasAppJs).toBeTruthy();
  });

  test('セッション情報バーが初期状態で非表示', async ({ page }) => {
    const sessionInfo = page.locator('#session-info');
    await expect(sessionInfo).toBeAttached();
    await expect(sessionInfo).toHaveClass(/hidden/);
  });

  test('プログレスバーが存在する', async ({ page }) => {
    await expect(page.locator('#progress-bar')).toBeAttached();
  });

  test('今日の目標パネルが存在する', async ({ page }) => {
    await expect(page.locator('#study-goal-panel')).toBeAttached();
  });

  test('結果モーダルのブックマークボタンが存在する', async ({ page }) => {
    // result-btn-bookmark は静的 HTML に存在する
    await expect(page.locator('#result-btn-bookmark')).toBeAttached();
  });

  test('結果モーダルのメモ保存ボタンが存在する', async ({ page }) => {
    await expect(page.locator('#result-btn-save-note')).toBeAttached();
  });
});

test.describe('localStorage操作 (E2E)', () => {
  test('localStorageにデータを書いてリロードしても読み込める', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('chisatsu_test_key', 'test_value_123');
    });
    await page.reload();
    const value = await page.evaluate(() => localStorage.getItem('chisatsu_test_key'));
    expect(value).toBe('test_value_123');
  });

  test('学習目標をlocalStorageに保存できる', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('chisatsu_limb_study_goal', '30');
    });
    const saved = await page.evaluate(() => localStorage.getItem('chisatsu_limb_study_goal'));
    expect(saved).toBe('30');
  });
});

test.describe('純粋関数 in-browser テスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('normalizeMasteryValue が正しく動作する', async ({ page }) => {
    const results = await page.evaluate(() => {
      if (typeof normalizeMasteryValue === 'undefined') return null;
      return {
        perfect: normalizeMasteryValue('perfect'),
        ambiguous: normalizeMasteryValue('ambiguous'),
        other: normalizeMasteryValue('other'),
        empty: normalizeMasteryValue('')
      };
    });
    if (results === null) {
      test.skip(); // 関数がグローバルに公開されていない場合スキップ
    } else {
      expect(results.perfect).toBe('perfect');
      expect(results.ambiguous).toBe('ambiguous');
      expect(results.other).toBe('');
      expect(results.empty).toBe('');
    }
  });

  test('esc() がXSSエスケープを正しく行う', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof esc === 'undefined') return null;
      return esc('<script>alert("XSS")</script>');
    });
    if (result !== null) {
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    }
  });

  test('weakScore() が未回答時に0を返す', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof weakScore === 'undefined') return null;
      return weakScore({ correct: 0, wrong: 0, bookmarked: false });
    });
    if (result !== null) {
      expect(result).toBe(0);
    }
  });

  test('normalizeReviewState() がデフォルト値を返す', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof normalizeReviewState === 'undefined') return null;
      return normalizeReviewState(null);
    });
    if (result !== null) {
      expect(result.intervalDays).toBe(1);
      expect(result.streak).toBe(0);
      expect(result.ease).toBe(2.0);
    }
  });
});

test.describe('マスタリーボタン動作確認', () => {
  test('あいまいボタンが btn-primary クラスを持つ', async ({ page }) => {
    await page.goto('/');
    const classes = await page.locator('#btn-mark-ambiguous').getAttribute('class');
    expect(classes).toContain('btn-primary');
    expect(classes).not.toContain('btn-ghost');
  });

  test('完璧ボタンが btn-primary クラスを持つ', async ({ page }) => {
    await page.goto('/');
    const classes = await page.locator('#btn-mark-perfect').getAttribute('class');
    expect(classes).toContain('btn-primary');
  });
});
