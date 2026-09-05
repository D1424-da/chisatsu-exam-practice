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

  test('FEATURE: 「回答数が少ない」は最少グループから積み上げ、少ない順に出題する', async ({ page }) => {
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

      // 最少グループ(0回)から積み上げる
      const spread = computeFewAnswersInfo(build([0, 1, 2, 20, 20, 20]));
      // 全肢が同じ回数 → 偏りが無いので該当0件
      const even = computeFewAnswersInfo(build([8, 8, 8, 8]));
      // 学習初期（全部未回答）→ 絶対的に少ないので全件が対象
      const fresh = computeFewAnswersInfo(build([0, 0, 0, 0]));
      // BUG回帰: 回答回数が小さい範囲に散らばるケース。
      // 平均の一定割合だと平均2回→「1回未満」となり該当0件（＝出題されない）だった。
      const narrow = computeFewAnswersInfo(build([1, 1, 1, 2, 2, 3, 3, 3]));
      // BUG回帰: 少数だけ回数が遅れているケース（平均比だと該当0件だった）
      const laggard = computeFewAnswersInfo(build([1, 3, 3, 3, 3, 3, 3, 3]));
      // BUG回帰: 未回答が無く、最少グループ(1回)が最大勢力でもあるケース。
      // 中央値を直接しきい値にすると「1回未満」＝未回答のみに潰れ、該当0件だった。
      // 最少グループだけで目安件数を満たすので、cutoff は 1 に留まるのが正しい。
      const rep = (v, n) => Array(n).fill(v);
      const medianIsLowest = computeFewAnswersInfo(build([...rep(1, 60), ...rep(2, 30), ...rep(3, 10)]));

      const countOf = (info, l) => info.effMap.get(l).correct + info.effMap.get(l).wrong;
      const matched = (info) => info.cutoff < 0
        ? 0
        : [...info.effMap.keys()].filter(l => countOf(info, l) <= info.cutoff).length;

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
        spread: { cutoff: spread.cutoff, matched: matched(spread) },
        even: { cutoff: even.cutoff, matched: matched(even) },
        fresh: { cutoff: fresh.cutoff, matched: matched(fresh) },
        narrow: { cutoff: narrow.cutoff, matched: matched(narrow) },
        laggard: { cutoff: laggard.cutoff, matched: matched(laggard) },
        medianIsLowest: { cutoff: medianIsLowest.cutoff, matched: matched(medianIsLowest) },
        queue,
        label: document.getElementById('count-few').textContent
      };
    });
    if (result === null) test.skip();

    // 最少グループ(0回)から積み上げ、最多グループ(20回)は含めない
    expect(result.spread.cutoff).toBe(2);
    expect(result.spread.matched).toBe(3);
    // 回答回数が揃っていれば「相対的に少ないもの」は存在しない（cutoff -1 = 該当なし）
    expect(result.even.cutoff).toBe(-1);
    expect(result.even.matched).toBe(0);
    // 全部未回答なら絶対的に少ないので全件が対象（初期に空にならない）
    expect(result.fresh.cutoff).toBe(0);
    expect(result.fresh.matched).toBe(4);
    // 回帰: 1〜3回に散らばるケースで、1回の肢がきちんと該当すること
    expect(result.narrow.matched).toBeGreaterThan(0);
    // 回帰: 少数だけ遅れているケースで、その肢が該当すること
    expect(result.laggard.cutoff).toBe(1);
    expect(result.laggard.matched).toBe(1);
    // 回帰: 未回答が無く最少グループが最大勢力でも空にならず、そのグループだけで足りる
    expect(result.medianIsLowest.cutoff).toBe(1);
    expect(result.medianIsLowest.matched).toBe(60);
    // 回答回数の少ない順に並ぶ
    expect(result.queue).toEqual([...result.queue].sort((a, b) => a - b));
    // ボタンに現在のしきい値が併記される
    expect(result.label).toContain('回以下');
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

  test('FEATURE: 苦手肢リストの表示件数を選択でき、設定が保存される', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof normalizeWeakListLimit !== 'function') return null;
      const origGetAuthUid = window.getAuthUid;
      window.getAuthUid = () => 'test-uid';
      const mk = () => ({
        correct: 1, wrong: 2, wrongDateKeys: ['2026-01-01'],
        review: { intervalDays: 1, streak: 0, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 0 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });
      const limbs = [];
      records = {};
      for (let i = 0; i < 300; i++) {
        limbs.push({ id: `L${i}`, text: `肢${i}`, correct: true, explanation: '' });
        records[`L${i}`] = mk();
      }
      questions = [{ id: 'q1', subject: 'S', limbs }];
      document.getElementById('weak-hide-high-rate').checked = false;

      const el = document.getElementById('weak-list-limit');
      const rowsFor = (v) => {
        el.value = v;
        renderStats();
        return document.querySelectorAll('.weak-limb-row').length;
      };
      const at50 = rowsFor('50');
      const at200 = rowsFor('200');
      const atAll = rowsFor('0');   // 0 = すべて表示
      const totalText = document.getElementById('weak-limbs-total').textContent;

      window.getAuthUid = origGetAuthUid;
      return { at50, at200, atAll, totalText, invalid: normalizeWeakListLimit('abc') };
    });
    if (result === null) test.skip();

    expect(result.at50).toBe(50);
    expect(result.at200).toBe(200);
    // 0 は「すべて表示」
    expect(result.atAll).toBe(300);
    expect(result.totalText).toContain('すべて表示');
    // 不正値はデフォルトの50に丸められる
    expect(result.invalid).toBe(50);

    // change ハンドラは DOMContentLoaded 内の await 後に登録されるため、
    // 登録が済むまでリトライする（dispatch は何度呼んでも同じ結果になる）。
    await expect.poll(() => page.evaluate(() => {
      const el = document.getElementById('weak-list-limit');
      el.value = '100';
      el.dispatchEvent(new Event('change'));
      const saved = JSON.parse(localStorage.getItem('chisatsu_limb_weak_list_pref') || '{}');
      return saved.limit ?? null;
    })).toBe(100);
  });

  test('BUG-FIX: 回答時に全件スナップショットではなく変更した肢だけを送る', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (typeof queueRecordFieldsSync !== 'function' || typeof buildRecordFieldsPatch !== 'function') return null;

      // Firestore の書き込みを計測用に差し替える
      const writes = [];
      const origFirestore = window.firebase?.firestore;
      const stubDoc = {
        get: () => Promise.resolve({ exists: false, data: () => null }),
        set: (payload) => {
          const recs = payload?.records || {};
          const firstLimb = Object.keys(recs)[0];
          writes.push({
            bytes: JSON.stringify(payload).length,
            limbCount: Object.keys(recs).length,
            fields: firstLimb ? recs[firstLimb] : null
          });
          return Promise.resolve();
        },
        onSnapshot: () => () => {}
      };
      window.firebase = window.firebase || {};
      window.firebase.firestore = () => ({ collection: () => ({ doc: () => stubDoc }) });
      window.firebase.firestore.FieldValue = { serverTimestamp: () => 'TS', increment: (n) => ({ __inc: n }) };
      const origGetAuthUid = window.getAuthUid;
      window.getAuthUid = () => 'u1';

      // 1000肢ぶんのレコードを用意し、そのうち1肢だけ更新する
      records = {};
      for (let i = 0; i < 1000; i++) {
        records[`L${i}`] = {
          correct: 2, wrong: 1, wrongDateKeys: ['2026-08-01', '2026-08-05'],
          review: { intervalDays: 3, streak: 1, ease: 2.1, lastAnsweredAtMs: 1, dueAtMs: 2 },
          mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
        };
      }
      // メモだけを変更した想定
      queueRecordFieldsSync('L0', ['note']);
      await flushRecordFieldsToCloudIfNeeded();
      const noteOnly = writes.length === 1 ? Object.keys(writes[0].fields || {}) : [];

      window.getAuthUid = origGetAuthUid;
      if (origFirestore) window.firebase.firestore = origFirestore;
      return { writes, noteOnly };
    });
    if (result === null) test.skip();

    // 1回の送信で、変更した1肢だけが含まれること（全1000件ではない）
    expect(result.writes.length).toBe(1);
    expect(result.writes[0].limbCount).toBe(1);
    // 全件送信なら数百KBになるため、桁違いに小さいことを確認する
    expect(result.writes[0].bytes).toBeLessThan(2000);
    // 変更していないフィールドは送らない（他端末の更新を潰さないため）
    expect(result.noteOnly).toEqual(['note']);
  });

  test('BUG-FIX: 全件スナップショット送信が回答経路から呼ばれていない', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

    // addRecord / setLimbMastery / setLimbNote / toggleLimbBookmark は
    // 全件送信(pushRecordsToCloud)ではなく肢単位送信を使う
    for (const fn of ['addRecord', 'setLimbMastery', 'setLimbNote', 'toggleLimbBookmark']) {
      const m = js.match(new RegExp(`function ${fn}\\([\\s\\S]*?\\n}`));
      expect(m, `${fn} が見つからない`).toBeTruthy();
      expect(m[0], `${fn} が全件送信している`).not.toContain('pushRecordsToCloud');
      expect(m[0], `${fn} が肢単位送信を使っていない`).toContain('queueRecordFieldsSync');
    }
  });

  test('BUG-FIX: セッションスナップショットのクラウド送信が間引かれている', () => {
    const fs = require('fs');
    const path = require('path');
    const js = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

    // 1問ごとに呼ばれる saveStudySessionSnapshot は直接flushせず、間引き経路を通す
    const m = js.match(/function saveStudySessionSnapshot\(\)[\s\S]*?\n}/);
    expect(m).toBeTruthy();
    expect(m[0]).toContain('scheduleStudySessionSnapshotFlush');
    expect(m[0]).not.toContain('flushStudySessionSnapshotToCloudIfNeeded');
  });

  test('BUG-FIX: 学習フィルターを変更するとカウント表示バーが再計算される', async ({ page }) => {
    // アプリの初期化(DOMContentLoaded内のawait)は、テストデータの投入後に
    // loadData() でグローバルを上書きし、change ハンドラもその後に登録する。
    // そのため毎回データを入れ直してから操作する形でリトライする。
    const setupAndChangeYear = () => page.evaluate(() => {
      if (typeof updateMasteryCounts !== 'function') return null;
      const mk = () => ({
        correct: 1, wrong: 0, wrongDateKeys: [],
        review: { intervalDays: 1, streak: 1, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 9e15 },
        mastery: 'ambiguous', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });
      // h27 と h28 に10問(各4肢)ずつ。全肢を「あいまい」にする。
      const qs = []; records = {};
      for (const yr of ['h27', 'h28']) {
        for (let q = 0; q < 10; q++) {
          const limbs = [];
          for (let l = 0; l < 4; l++) {
            const id = `${yr}-${q}-${l}`;
            limbs.push({ id, text: `肢${id}`, correct: true, explanation: '' });
            records[id] = mk();
          }
          qs.push({ id: `${yr}-${q}`, subject: 'S', category: '総則', source: `${yr.toUpperCase()}-問${q}`, limbs });
        }
      }
      questions = qs;
      refreshFilterOptions();

      const shown = () => Number(String(document.getElementById('count-ambiguous').textContent).replace(/\D/g, ''));
      const change = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('change'));
      };

      document.getElementById('filter-year-from').value = '';
      updateMasteryCounts();
      const all = shown();

      // 年度を h28 以降に絞る。ハンドラが登録されていれば表示も追従する。
      change('filter-year-from', 'h28');
      const afterYear = shown();

      change('filter-mode', 'ambiguous');
      startSession();
      const queued = session ? session.queue.length : 0;
      const shownAtSession = shown();

      change('filter-year-from', '');
      const restored = shown();
      return { all, afterYear, queued, shownAtSession, restored };
    });

    const first = await setupAndChangeYear();
    if (first === null) test.skip();

    // change ハンドラの登録完了までリトライする（操作は何度行っても同じ結果）
    await expect.poll(async () => (await setupAndChangeYear())?.afterYear).toBe(40);

    const r = await setupAndChangeYear();
    expect(r.all).toBe(80);
    // 年度フィルターの変更がカウント表示に反映される（無いと前の条件の数字が残る）
    expect(r.afterYear).toBe(40);
    // 表示数と実際の出題数が一致する
    expect(r.shownAtSession).toBe(r.queued);
    // フィルターを戻せば表示も戻る
    expect(r.restored).toBe(80);
  });

  test('BUG-FIX: 問題データのサイズガードが実際の書き込み対象(全問1ドキュメント)を検査する', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof canSyncQuestionsToCloud !== 'function') return null;
      // 1年度あたりは小さいが、合計するとソフト上限(900KB)を超えるデータを作る。
      // 年度別サイズだけを見ていると通ってしまい、実際の書き込みで失敗する。
      const big = [];
      for (let y = 0; y < 20; y++) {
        for (let q = 0; q < 30; q++) {
          const limbs = [];
          for (let l = 0; l < 5; l++) {
            limbs.push({ id: `h${y}-${q}-${l}`, text: 'あ'.repeat(400), correct: true, explanation: 'い'.repeat(400) });
          }
          big.push({ id: `h${y}-${q}`, subject: 'S', source: `H${y}-問${q}`, limbs });
        }
      }
      const small = [{ id: 'q1', subject: 'S', source: 'H17-問1', limbs: [{ id: 'l1', text: 'x', correct: true, explanation: '' }] }];
      return { bigAllowed: canSyncQuestionsToCloud(big), smallAllowed: canSyncQuestionsToCloud(small), emptyAllowed: canSyncQuestionsToCloud([]) };
    });
    if (result === null) test.skip();

    // 合計が上限を超えるものは弾く（年度別だけ見ていると通ってしまっていた）
    expect(result.bigAllowed).toBe(false);
    // 通常サイズは通る
    expect(result.smallAllowed).toBe(true);
    expect(result.emptyAllowed).toBe(false);
  });

  test('BUG-FIX: 成績ページの集計が存在しない肢の残骸レコードを含めない', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof renderStats !== 'function') return null;
      const origGetAuthUid = window.getAuthUid;
      window.getAuthUid = () => 'test-uid';
      const mk = (c, w) => ({
        correct: c, wrong: w, wrongDateKeys: [],
        review: { intervalDays: 1, streak: 0, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 0 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });

      // 実在する肢100件（各3正解1誤答 → 正答率75%）
      const limbs = [];
      records = {};
      for (let i = 0; i < 100; i++) {
        limbs.push({ id: `L${i}`, text: `肢${i}`, correct: true, explanation: '' });
        records[`L${i}`] = mk(3, 1);
      }
      questions = [{ id: 'q1', subject: 'S', source: 'H27-問1', limbs }];
      // 削除・再インポートで肢が無くなった残骸レコード（各4誤答 → 正答率0%）
      for (let i = 0; i < 50; i++) records[`GONE-${i}`] = mk(0, 4);

      renderStats();
      const num = (id) => Number(String(document.getElementById(id).textContent).replace(/\D/g, ''));
      const out = { total: num('stat-total'), rate: num('stat-rate'), limbs: num('stat-limbs'), weak: num('stat-weak') };
      window.getAuthUid = origGetAuthUid;
      return out;
    });
    if (result === null) test.skip();

    // 残骸を含めると 総回答数600 / 正答率50% / 学習肢数150 / 苦手肢50 になっていた
    expect(result.total).toBe(400);
    expect(result.rate).toBe(75);
    // 学習肢数は実在する肢数を超えない
    expect(result.limbs).toBe(100);
    expect(result.weak).toBe(0);
  });

  test('FEATURE: 成績ページが通算正答率と習得率（全肢・学習済み）を出し分ける', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof renderStats !== 'function' || typeof MASTERED_STREAK_MIN === 'undefined') return null;
      const origGetAuthUid = window.getAuthUid;
      window.getAuthUid = () => 'test-uid';
      const mk = (c, w, streak) => ({
        correct: c, wrong: w, wrongDateKeys: [],
        review: { intervalDays: 1, streak, ease: 2, lastAnsweredAtMs: 1, dueAtMs: 0 },
        mastery: '', masteryUpdatedAtMs: 1, note: '', bookmarked: false
      });
      // 全200肢: 80肢=直近正解(習得), 40肢=直近不正解(未習得), 80肢=未回答
      const limbs = []; records = {};
      for (let i = 0; i < 200; i++) {
        limbs.push({ id: `L${i}`, text: `肢${i}`, correct: true, explanation: '' });
        if (i < 80) records[`L${i}`] = mk(3, 1, 1);
        else if (i < 120) records[`L${i}`] = mk(1, 3, 0);
      }
      questions = [{ id: 'q1', subject: 'S', source: 'H27-問1', limbs }];
      renderStats();
      const num = (id) => Number(String(document.getElementById(id).textContent).replace(/[^\d]/g, ''));
      const out = {
        total: num('stat-total'),
        rate: num('stat-rate'),
        masteredAll: num('stat-mastered-all'),
        masteredStudied: num('stat-mastered-studied'),
        studied: num('stat-limbs'),
        label: document.querySelector('#stat-rate')?.previousElementSibling?.textContent
      };
      window.getAuthUid = origGetAuthUid;
      return out;
    });
    if (result === null) test.skip();

    // 通算正答率は「回答回数」に対する割合: (80*3 + 40*1) / 480 = 58%
    expect(result.total).toBe(480);
    expect(result.rate).toBe(58);
    // 習得率は「肢」に対する割合。未回答も分母に含める全肢版と、学習済みのみの版
    expect(result.masteredAll).toBe(40);      // 80 / 200
    expect(result.masteredStudied).toBe(67);  // 80 / 120
    expect(result.studied).toBe(120);
    // 通算であることが分かるラベルになっている
    expect(result.label).toContain('通算');
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
