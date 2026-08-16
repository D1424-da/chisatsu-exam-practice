// 単体テスト: app.js の純粋関数群
// Node.js 組み込みテストランナー (node:test) を使用
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

// ── テスト対象関数をインライン定義（DOM/Firebase 依存を排除） ──────────

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeMasteryValue(value) {
  return value === 'perfect' || value === 'ambiguous' ? value : '';
}

function normalizeReviewState(review) {
  const src = (review && typeof review === 'object') ? review : {};
  const intervalDays = Math.max(1, Math.floor(Number(src.intervalDays || 1)));
  const streak = Math.max(0, Math.floor(Number(src.streak || 0)));
  const ease = Math.min(2.5, Math.max(1.3, Number(src.ease || 2.0)));
  const lastAnsweredAtMs = Math.max(0, Number(src.lastAnsweredAtMs || 0));
  const dueAtMs = Math.max(0, Number(src.dueAtMs || 0));
  return { intervalDays, streak, ease, lastAnsweredAtMs, dueAtMs };
}

function weakScore(r) {
  const total = r.correct + r.wrong;
  let s = total === 0 ? 0 : r.wrong / total + r.wrong * 0.1;
  if (r.bookmarked) s += 2;
  return s;
}

function normalizeWrongDateKeys(values) {
  const src = Array.isArray(values) ? values : [];
  const keys = [];
  for (const v of src) {
    const key = String(v || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (!keys.includes(key)) keys.push(key);
  }
  const sorted = keys.sort();
  return sorted.length > 20 ? sorted.slice(sorted.length - 20) : sorted;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isOutstandingWrong(rec) {
  if (!rec) return false;
  if (Math.max(0, Number(rec.wrong || 0)) <= 0) return false;
  return normalizeReviewState(rec.review).streak === 0;
}

function nextReviewState(current, isCorrect, nowMs = Date.now()) {
  const prev = normalizeReviewState(current);
  if (!isCorrect) {
    return {
      intervalDays: 1,
      streak: 0,
      ease: Math.max(1.3, prev.ease - 0.2),
      lastAnsweredAtMs: nowMs,
      dueAtMs: nowMs
    };
  }
  const streak = prev.streak + 1;
  const intervalDays = streak === 1
    ? 1
    : streak === 2
    ? 3
    : Math.max(1, Math.round(prev.intervalDays * prev.ease));
  return {
    intervalDays,
    streak,
    ease: Math.min(2.5, prev.ease + 0.1),
    lastAnsweredAtMs: nowMs,
    dueAtMs: nowMs + intervalDays * DAY_MS
  };
}

function makeInlineRecordId(limbId, key) {
  return `${limbId}::${key}`;
}

// app.js の priorityReviewScore と同じ計算式（getEffectiveRecord による
// 実効レコード取得部分を除き、レコード r を直接受け取る形でテストする）
function priorityReviewScoreFromRecord(r, nowMs = Date.now()) {
  const total = r.correct + r.wrong;
  let s = 0;
  s += r.wrong * 3;
  if (normalizeMasteryValue(r.mastery) === 'ambiguous') s += 2;
  if (total === 0) {
    s += 1 + 2;
  } else {
    const review = normalizeReviewState(r.review);
    const dueAt = review.dueAtMs || review.lastAnsweredAtMs;
    if (dueAt <= 0 || dueAt <= nowMs) s += 2;
  }
  s += 4 / (total + 1);
  s += weakScore(r) * 5;
  return s;
}

function normalizeCategoryLabel(category) {
  const value = String(category || '')
    .replace(/[：:]/g, '・')
    .replace(/\s*・\s*/g, '・')
    .trim();
  const aliasMap = {
    '行政事件訴訟法': '行政事件訴訟',
    '行政手続法': '行政手続',
    '地方自治法': '地方自治'
  };
  return aliasMap[value] || value;
}

// ── テスト群 ─────────────────────────────────────────────────────

describe('normalizeMasteryValue', () => {
  test('perfect を返す', () => {
    assert.equal(normalizeMasteryValue('perfect'), 'perfect');
  });
  test('ambiguous を返す', () => {
    assert.equal(normalizeMasteryValue('ambiguous'), 'ambiguous');
  });
  test('不正値は空文字を返す', () => {
    assert.equal(normalizeMasteryValue('other'), '');
    assert.equal(normalizeMasteryValue(''), '');
    assert.equal(normalizeMasteryValue(null), '');
    assert.equal(normalizeMasteryValue(undefined), '');
    assert.equal(normalizeMasteryValue(123), '');
  });
});

describe('normalizeReviewState', () => {
  test('null入力でデフォルト値を返す', () => {
    const r = normalizeReviewState(null);
    assert.equal(r.intervalDays, 1);
    assert.equal(r.streak, 0);
    assert.equal(r.ease, 2.0);
    assert.equal(r.lastAnsweredAtMs, 0);
    assert.equal(r.dueAtMs, 0);
  });
  test('ease は 1.3〜2.5 にクランプされる', () => {
    assert.equal(normalizeReviewState({ ease: 0.5 }).ease, 1.3);
    assert.equal(normalizeReviewState({ ease: 9.9 }).ease, 2.5);
    assert.equal(normalizeReviewState({ ease: 2.0 }).ease, 2.0);
  });
  test('intervalDays は最低 1', () => {
    assert.equal(normalizeReviewState({ intervalDays: 0 }).intervalDays, 1);
    assert.equal(normalizeReviewState({ intervalDays: -5 }).intervalDays, 1);
  });
  test('streak は最低 0', () => {
    assert.equal(normalizeReviewState({ streak: -1 }).streak, 0);
  });
  test('小数は切り捨て', () => {
    assert.equal(normalizeReviewState({ intervalDays: 3.9 }).intervalDays, 3);
    assert.equal(normalizeReviewState({ streak: 2.7 }).streak, 2);
  });
});

describe('priorityReviewScore（回答回数が少ないほど加点）', () => {
  const nowMs = 1_700_000_000_000;
  const futureReview = { intervalDays: 10, streak: 3, ease: 2.0, lastAnsweredAtMs: nowMs, dueAtMs: nowMs + 5 * DAY_MS };

  function makeRecord(correct, wrong, overrides = {}) {
    return {
      correct, wrong,
      mastery: '', bookmarked: false,
      review: futureReview,
      ...overrides
    };
  }

  test('回答回数が少ないほどスコアが高くなる（期限内・非あいまい・非ブックマークの条件を揃えた場合）', () => {
    const fewAnswers = priorityReviewScoreFromRecord(makeRecord(1, 0));   // total=1
    const manyAnswers = priorityReviewScoreFromRecord(makeRecord(20, 0)); // total=20
    assert.ok(fewAnswers > manyAnswers, `回答回数1(${fewAnswers}) > 回答回数20(${manyAnswers}) であるべき`);
  });

  test('回答回数が増えるほど加点は滑らかに減衰する（単調減少）', () => {
    const totals = [1, 2, 5, 10, 20, 50];
    const scores = totals.map(t => priorityReviewScoreFromRecord(makeRecord(t, 0)));
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] < scores[i - 1], `total=${totals[i]}のスコア(${scores[i]})はtotal=${totals[i - 1]}のスコア(${scores[i - 1]})より小さいはず`);
    }
  });

  test('未回答(total=0)は依然として最優先される', () => {
    const unanswered = priorityReviewScoreFromRecord(makeRecord(0, 0));
    const answeredOnce = priorityReviewScoreFromRecord(makeRecord(1, 0));
    assert.ok(unanswered > answeredOnce, `未回答(${unanswered}) > 1回回答済み(${answeredOnce}) であるべき`);
  });

  test('回答回数ボーナスは4/(total+1)で計算される', () => {
    const r = makeRecord(3, 0); // total=3, wrong=0, ambiguousでない, dueAt未来なので due加点なし
    const score = priorityReviewScoreFromRecord(r, nowMs);
    // s = wrong*3(0) + ambiguous(0) + due加点(0, 未来なので) + 4/(3+1)(=1) + weakScore*5(0, wrong=0のため)
    assert.equal(score, 1);
  });
});

describe('weakScore', () => {
  test('未回答（total=0）は 0 を返す', () => {
    assert.equal(weakScore({ correct: 0, wrong: 0, bookmarked: false }), 0);
  });
  test('ブックマーク済みは +2', () => {
    assert.equal(weakScore({ correct: 0, wrong: 0, bookmarked: true }), 2);
  });
  test('wrong=1 correct=0 のスコアは正', () => {
    const s = weakScore({ correct: 0, wrong: 1, bookmarked: false });
    assert.ok(s > 0, `期待: >0, 実際: ${s}`);
  });
  test('wrong が多いほどスコアが高い', () => {
    const s1 = weakScore({ correct: 1, wrong: 1, bookmarked: false });
    const s2 = weakScore({ correct: 1, wrong: 3, bookmarked: false });
    assert.ok(s2 > s1, `wrong=3 のスコア(${s2}) > wrong=1 のスコア(${s1})`);
  });
  test('ブックマーク未使用時と+2の差', () => {
    const base = weakScore({ correct: 2, wrong: 1, bookmarked: false });
    const bookmarked = weakScore({ correct: 2, wrong: 1, bookmarked: true });
    assert.equal(bookmarked - base, 2);
  });
});

describe('normalizeWrongDateKeys', () => {
  test('空配列を返す（null入力）', () => {
    assert.deepEqual(normalizeWrongDateKeys(null), []);
  });
  test('無効な日付形式を除外する', () => {
    assert.deepEqual(normalizeWrongDateKeys(['2024-01-01', 'invalid', '20240101']), ['2024-01-01']);
  });
  test('重複を除去する', () => {
    assert.deepEqual(normalizeWrongDateKeys(['2024-01-01', '2024-01-01']), ['2024-01-01']);
  });
  test('ソートされた順序で返す', () => {
    const result = normalizeWrongDateKeys(['2024-03-01', '2024-01-01', '2024-02-01']);
    assert.deepEqual(result, ['2024-01-01', '2024-02-01', '2024-03-01']);
  });
  test('21件以上は最新20件のみ保持', () => {
    const dates = [];
    for (let i = 1; i <= 21; i++) {
      dates.push(`2024-${String(i).padStart(2, '0')}-01`);
    }
    const result = normalizeWrongDateKeys(dates);
    assert.equal(result.length, 20);
    assert.equal(result[0], '2024-02-01'); // 最古が削除される
  });
});

describe('esc (XSSエスケープ)', () => {
  test('null/undefined は空文字を返す', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
  });
  test('< > & " \' をエスケープ', () => {
    assert.equal(esc('<script>'), '&lt;script&gt;');
    assert.equal(esc('"quoted"'), '&quot;quoted&quot;');
    assert.equal(esc("it's"), 'it&#39;s');
    assert.equal(esc('a & b'), 'a &amp; b');
  });
  test('通常文字列はそのまま', () => {
    assert.equal(esc('hello world'), 'hello world');
    assert.equal(esc('土地家屋調査士'), '土地家屋調査士');
  });
  test('数値も文字列化してエスケープ', () => {
    assert.equal(esc(42), '42');
  });
});

describe('isOutstandingWrong', () => {
  test('null rec は false', () => {
    assert.equal(isOutstandingWrong(null), false);
  });
  test('wrong=0 は false', () => {
    assert.equal(isOutstandingWrong({ wrong: 0, review: null }), false);
  });
  test('wrong>0 かつ streak=0 は true', () => {
    assert.equal(isOutstandingWrong({ wrong: 1, review: { streak: 0 } }), true);
  });
  test('wrong>0 かつ streak=1 は false（克服済み）', () => {
    assert.equal(isOutstandingWrong({ wrong: 1, review: { streak: 1 } }), false);
  });
});

describe('nextReviewState', () => {
  const nowMs = 1_700_000_000_000;

  test('不正解でリセット: streak=0, intervalDays=1, ease減少', () => {
    const prev = { streak: 5, ease: 2.0, intervalDays: 10, lastAnsweredAtMs: 0, dueAtMs: 0 };
    const next = nextReviewState(prev, false, nowMs);
    assert.equal(next.streak, 0);
    assert.equal(next.intervalDays, 1);
    assert.equal(next.ease, 1.8); // 2.0 - 0.2
    assert.equal(next.dueAtMs, nowMs); // 即復習
  });
  test('ease は 1.3 未満にならない', () => {
    const prev = { streak: 0, ease: 1.3, intervalDays: 1, lastAnsweredAtMs: 0, dueAtMs: 0 };
    const next = nextReviewState(prev, false, nowMs);
    assert.equal(next.ease, 1.3);
  });
  test('初回正解: streak=1, intervalDays=1', () => {
    const next = nextReviewState(null, true, nowMs);
    assert.equal(next.streak, 1);
    assert.equal(next.intervalDays, 1);
  });
  test('2回目正解: streak=2, intervalDays=3', () => {
    const prev = { streak: 1, ease: 2.0, intervalDays: 1, lastAnsweredAtMs: 0, dueAtMs: 0 };
    const next = nextReviewState(prev, true, nowMs);
    assert.equal(next.streak, 2);
    assert.equal(next.intervalDays, 3);
  });
  test('3回目以降: intervalDays = round(prev.intervalDays * ease)', () => {
    const prev = { streak: 2, ease: 2.0, intervalDays: 3, lastAnsweredAtMs: 0, dueAtMs: 0 };
    const next = nextReviewState(prev, true, nowMs);
    assert.equal(next.intervalDays, 6); // round(3 * 2.0)
  });
  test('正解で ease が増加（max 2.5）', () => {
    const prev = { streak: 1, ease: 2.5, intervalDays: 1, lastAnsweredAtMs: 0, dueAtMs: 0 };
    const next = nextReviewState(prev, true, nowMs);
    assert.equal(next.ease, 2.5); // 上限
  });
  test('dueAtMs = nowMs + intervalDays * DAY_MS', () => {
    const next = nextReviewState(null, true, nowMs);
    assert.equal(next.dueAtMs, nowMs + 1 * DAY_MS);
  });
});

describe('makeInlineRecordId', () => {
  test('limbId::key の形式で返す', () => {
    assert.equal(makeInlineRecordId('limb-123', '①'), 'limb-123::①');
    assert.equal(makeInlineRecordId('abc', 'ア'), 'abc::ア');
  });
});

describe('normalizeCategoryLabel', () => {
  test('全角コロンを中点に変換', () => {
    assert.equal(normalizeCategoryLabel('民法：物権'), '民法・物権');
  });
  test('エイリアスマップを適用', () => {
    assert.equal(normalizeCategoryLabel('行政事件訴訟法'), '行政事件訴訟');
    assert.equal(normalizeCategoryLabel('行政手続法'), '行政手続');
    assert.equal(normalizeCategoryLabel('地方自治法'), '地方自治');
  });
  test('null/undefined は空文字', () => {
    assert.equal(normalizeCategoryLabel(null), '');
    assert.equal(normalizeCategoryLabel(undefined), '');
  });
  test('前後の空白をトリム', () => {
    assert.equal(normalizeCategoryLabel('  民法  '), '民法');
  });
});
