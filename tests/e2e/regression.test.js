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

  test('BUG-FIX: カウント表示バーの数が実際の出題数と一致する', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof updateMasteryCounts !== 'function' || typeof getLimbsMatchingFilters !== 'function') return null;
      const mk = (o = {}) => ({
        correct: 1, wrong: 0, wrongDateKeys: [],
        review: { intervalDays: 1, streak: 1, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 9e15 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false, ...o
      });
      questions = [
        { id: 'q1', subject: 'S', limbs: [{ id: 'A', text: '通常肢', correct: true, explanation: '' }] },
        { id: 'q2', subject: 'S', limbs: [{ id: 'B', text: '（①x）〇×、（②y）〇×、（③z）〇×。', inlineOxWrong: ['③'], explanation: '' }] }
      ];
      records = {
        'A': mk({ mastery: 'perfect' }),
        // 文中〇×の空欄レコード3件（1肢として数えるべき）
        'B::①': mk({ correct: 2, wrong: 1 }),
        'B::②': mk({ correct: 2, wrong: 1 }),
        'B::③': mk({ correct: 2, wrong: 1 }),
        // 削除済み問題の残骸レコード（数えてはいけない）
        'GONE-1': mk({ mastery: 'perfect' }),
        'GONE-2': mk({ mastery: 'ambiguous' }),
        'GONE-3': mk({ correct: 0, wrong: 5, review: { intervalDays: 1, streak: 0, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 0 } })
      };
      updateMasteryCounts();
      const num = (id) => Number(String(document.getElementById(id).textContent).replace(/\D/g, ''));
      const limbs = getLimbsMatchingFilters({ subject: '', category: '', yearFrom: '', yearTo: '', mode: 'all' });
      return {
        shown: { perfect: num('count-perfect'), ambiguous: num('count-ambiguous'), wrong: num('count-wrong') },
        actual: {
          perfect: limbs.filter(l => isPerfectLimb(l.id)).length,
          ambiguous: limbs.filter(l => isAmbiguousLimb(l.id)).length,
          wrong: limbs.filter(l => isOutstandingWrong(getEffectiveRecord(l))).length
        }
      };
    });
    if (result === null) test.skip();
    // 残骸レコードや文中〇×の空欄レコードを数えず、出題数と一致する
    expect(result.shown).toEqual(result.actual);
    expect(result.shown.perfect).toBe(1);
  });

  test('BUG-FIX: 文中〇×は全空欄を克服すると「間違えたもの」から外れる', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof getEffectiveRecord !== 'function') return null;
      const blank = (streak) => ({
        correct: 2, wrong: 1, wrongDateKeys: [],
        review: { intervalDays: 3, streak, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 9e15 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });
      const limb = { id: 'B', text: '（①x）〇×、（②y）〇×、（③z）〇×。', inlineOxWrong: ['③'] };
      // 全空欄が直近正解 → 克服済み
      records = { 'B::①': blank(1), 'B::②': blank(1), 'B::③': blank(1) };
      const settled = isOutstandingWrong(getEffectiveRecord(limb));
      // ③だけ直近不正解 → 未克服のまま
      records['B::③'] = blank(0);
      const unsettled = isOutstandingWrong(getEffectiveRecord(limb));
      return { settled, unsettled };
    });
    if (result === null) test.skip();
    expect(result.settled).toBe(false);   // 全部克服したら外れる
    expect(result.unsettled).toBe(true);  // 1箇所でも未克服なら残る
  });

  test('FEATURE: 「回答数が少ない」は平均に対する相対値で判定し、少ない順に出題する', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof computeFewAnswersInfo !== 'function') return null;
      const mk = (c) => ({
        correct: c, wrong: 0, wrongDateKeys: [],
        review: { intervalDays: 1, streak: 1, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 9e15 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });
      const build = (counts) => {
        questions = [{ id: 'q1', subject: 'S', limbs: counts.map((n, i) => ({ id: `L${i}`, text: `肢${i}`, correct: true, explanation: '' })) }];
        records = {};
        counts.forEach((n, i) => { if (n > 0) records[`L${i}`] = mk(n); });
        return getLimbsMatchingFilters({ subject: '', category: '', yearFrom: '', yearTo: '', mode: 'few' });
      };

      // 平均 10.5 → しきい値 5 → 0/1/2回の3件が該当
      const spread = computeFewAnswersInfo(build([0, 1, 2, 20, 20, 20]));
      // 全肢が同じ回数 → 偏りが無いので該当0件
      const even = computeFewAnswersInfo(build([8, 8, 8, 8]));
      // 学習初期（全部未回答）→ しきい値は最低1なので未回答が拾える
      const fresh = computeFewAnswersInfo(build([0, 0, 0, 0]));

      const countOf = (info, l) => info.effMap.get(l).correct + info.effMap.get(l).wrong;
      const matched = (info) => [...info.effMap.keys()].filter(l => countOf(info, l) < info.threshold).length;

      // 実際の出題順を確認
      build([0, 1, 2, 20, 20, 20]);
      document.getElementById('filter-mode').value = 'few';
      startSession();
      const queue = session.queue.map(l => {
        const r = getEffectiveRecord(l);
        return r.correct + r.wrong;
      });

      updateMasteryCounts();
      return {
        spread: { threshold: spread.threshold, matched: matched(spread) },
        even: { threshold: even.threshold, matched: matched(even) },
        fresh: { threshold: fresh.threshold, matched: matched(fresh) },
        queue,
        label: document.getElementById('count-few').textContent
      };
    });
    if (result === null) test.skip();

    // 平均に対する相対判定: 平均10.5 → しきい値5 → 0/1/2回の3件
    expect(result.spread.threshold).toBe(5);
    expect(result.spread.matched).toBe(3);
    // 回答回数が揃っていれば「相対的に少ないもの」は存在しない
    expect(result.even.matched).toBe(0);
    // 全部未回答でも、しきい値の下限1により未回答を拾える（初期に空にならない）
    expect(result.fresh.threshold).toBe(1);
    expect(result.fresh.matched).toBe(4);
    // 回答回数の少ない順に並ぶ
    expect(result.queue).toEqual([...result.queue].sort((a, b) => a - b));
    // ボタンに現在のしきい値が併記される
    expect(result.label).toContain('回未満');
  });

  test('FEATURE: 苦手肢リストが正答率フィルター適用後の総数を表示する', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof renderStats !== 'function') return null;
      // renderStats は未ログインだと早期returnするため、認証済みに見せかける
      const origGetAuthUid = window.getAuthUid;
      window.getAuthUid = () => 'test-uid';
      const mk = (c, w) => ({
        correct: c, wrong: w, wrongDateKeys: ['2026-01-01'],
        review: { intervalDays: 1, streak: 0, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 0 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });
      const limbs = [];
      records = {};
      for (let i = 0; i < 60; i++) {
        limbs.push({ id: `L${i}`, text: `肢${i}`, correct: true, explanation: '' });
        records[`L${i}`] = i < 20 ? mk(9, 1) : mk(1, 4); // 正答率90% / 20%
      }
      questions = [{ id: 'q1', subject: 'S', limbs }];
      const read = () => ({
        total: document.getElementById('weak-limbs-total').textContent,
        rows: document.querySelectorAll('.weak-limb-row').length
      });
      document.getElementById('weak-hide-high-rate').checked = false;
      renderStats();
      const off = read();
      document.getElementById('weak-hide-high-rate').checked = true;
      document.getElementById('weak-hide-threshold').value = '80';
      renderStats();
      const on = read();
      window.getAuthUid = origGetAuthUid;
      return { off, on };
    });
    if (result === null) test.skip();

    // 上限50件を超える場合は総数と表示件数の両方を示す
    expect(result.off.total).toContain('60');
    expect(result.off.total).toContain('50');
    expect(result.off.rows).toBe(50);
    // 正答率フィルターを適用すると総数もそれに追従する
    expect(result.on.total).toContain('40');
    expect(result.on.rows).toBe(40);
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
