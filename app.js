/* =========================================================
   肢別問題集 - app.js
   ========================================================= */

// ── ストレージキー ──────────────────────────────────────────
 const KEY_QUESTIONS   = 'limb_questions';
const KEY_RECORDS     = 'limb_records';    // パーユーザーキー: limb_records_<userId>
const KEY_USERS       = 'limb_users';
const KEY_SESSION_USER = 'limb_session_user'; // sessionStorage

// ── 状態 ────────────────────────────────────────────
let questions   = [];   // 全問題
let records     = {};   // 成績
let session     = null; // 現在の学習セッション { queue: [limb], index, filter }
let currentUser = null; // { id, name }

// ── ユーティリティ ───────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function loadData() {
  try { questions = JSON.parse(localStorage.getItem(KEY_QUESTIONS)) || []; } catch { questions = []; }
  const rk = currentUser ? `${KEY_RECORDS}_${currentUser.id}` : KEY_RECORDS;
  try { records   = JSON.parse(localStorage.getItem(rk)) || {}; } catch { records = {}; }
}

async function syncBundledQuestions() {
  try {
    const resp = await fetch(`output/all_questions.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return;
    const bundled = await resp.json();
    if (!Array.isArray(bundled) || bundled.length === 0) return;
    localStorage.setItem(KEY_QUESTIONS, JSON.stringify(bundled));
    questions = bundled;
  } catch {
    // Bundled JSON is optional; fall back to existing localStorage data.
  }
}

function saveQuestions() {
  localStorage.setItem(KEY_QUESTIONS, JSON.stringify(questions));
  writeToFile();
}

function saveRecords() {
  const rk = currentUser ? `${KEY_RECORDS}_${currentUser.id}` : KEY_RECORDS;
  localStorage.setItem(rk, JSON.stringify(records));
  writeToFile();
}

// ── 認証関連 ────────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS)) || []; } catch { return []; }
}
function saveUsers(users) {
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
  writeToFile();
}

// ── ファイル永続化 ──────────────────────────────────────────────
const FS_SUPPORTED = 'showOpenFilePicker' in window;
let fileHandle    = null;
let pendingHandle = null; // 許可待ちファイルハンドル

// IndexedDB ラッパー（ファイルハンドル保存用）
const IDB = (() => {
  let _db = null;
  const open = () => new Promise((res, rej) => {
    if (_db) return res(_db);
    const r = indexedDB.open('limb_fs', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror   = e => rej(e.target.error);
  });
  return {
    get: async (key) => {
      try {
        const db = await open();
        return await new Promise((res, rej) => {
          const r = db.transaction('kv','readonly').objectStore('kv').get(key);
          r.onsuccess = () => res(r.result ?? null);
          r.onerror   = () => rej(r.error);
        });
      } catch { return null; }
    },
    set: async (key, val) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('kv','readwrite');
        t.objectStore('kv').put(val, key);
        t.oncomplete = res;
        t.onerror    = () => rej(t.error);
      });
    },
    del: async (key) => {
      try {
        const db = await open();
        return new Promise(res => {
          const t = db.transaction('kv','readwrite');
          t.objectStore('kv').delete(key);
          t.oncomplete = res;
          t.onerror    = res;
        });
      } catch { /* ignore */ }
    },
  };
})();

function getAllRecords() {
  const out = {};
  for (const u of getUsers()) {
    try { out[u.id] = JSON.parse(localStorage.getItem(`${KEY_RECORDS}_${u.id}`)) || {}; }
    catch { out[u.id] = {}; }
  }
  return out;
}

async function writeToFile() {
  if (!fileHandle) return;
  try {
    const data = { users: getUsers(), records: getAllRecords(), questions };
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (e) { console.warn('ファイル書き込みエラー:', e); }
}

async function applyFileData(data) {
  if (!data || typeof data !== 'object') throw new Error('不正なデータ形式');
  if (Array.isArray(data.users) && data.users.length > 0) localStorage.setItem(KEY_USERS, JSON.stringify(data.users));
  if (Array.isArray(data.questions)) { questions = data.questions; localStorage.setItem(KEY_QUESTIONS, JSON.stringify(questions)); }
  if (data.records && typeof data.records === 'object') {
    for (const [uid, recs] of Object.entries(data.records)) {
      localStorage.setItem(`${KEY_RECORDS}_${uid}`, JSON.stringify(recs));
    }
  }
}

async function connectHandle(handle) {
  const file = await handle.getFile();
  const data = JSON.parse(await file.text());
  await applyFileData(data);
  fileHandle    = handle;
  pendingHandle = null;
  await IDB.set('dataFileHandle', handle);
}

async function initFileStorage() {
  if (!FS_SUPPORTED) { updateFileStatus(); return; }
  try {
    const handle = await IDB.get('dataFileHandle');
    if (!handle) { updateFileStatus(); return; }
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      await connectHandle(handle);
    } else {
      pendingHandle = handle; // ユーザー操作が必要
    }
  } catch (e) { console.warn('ファイルストレージ初期化:', e); }
  updateFileStatus();
}

function updateFileStatus() {
  const statusEl   = document.getElementById('file-status');
  if (!statusEl) return;
  const reconnBar  = document.getElementById('file-reconnect-bar');
  const btnNew     = document.getElementById('btn-new-data-file');
  const btnOpen    = document.getElementById('btn-open-data-file');
  const btnDisconn = document.getElementById('btn-disconnect-file');
  const fsNote     = document.getElementById('fs-not-supported');
  if (!FS_SUPPORTED) {
    if (fsNote)     fsNote.classList.remove('hidden');
    if (btnNew)     btnNew.disabled = true;
    if (btnOpen)    btnOpen.disabled = true;
    if (btnDisconn) btnDisconn.disabled = true;
    return;
  }
  if (fileHandle) {
    statusEl.textContent = `接続中: ${fileHandle.name}`;
    statusEl.style.color = 'var(--success)';
    if (reconnBar)  reconnBar.classList.add('hidden');
    if (btnNew)     btnNew.disabled = true;
    if (btnOpen)    btnOpen.disabled = true;
    if (btnDisconn) btnDisconn.disabled = false;
  } else if (pendingHandle) {
    statusEl.textContent = `要再接続: ${pendingHandle.name}`;
    statusEl.style.color = 'var(--warn)';
    if (reconnBar)  reconnBar.classList.remove('hidden');
    if (btnNew)     btnNew.disabled = false;
    if (btnOpen)    btnOpen.disabled = false;
    if (btnDisconn) btnDisconn.disabled = true;
  } else {
    statusEl.textContent = '未設定';
    statusEl.style.color = 'var(--text-muted)';
    if (reconnBar)  reconnBar.classList.add('hidden');
    if (btnNew)     btnNew.disabled = false;
    if (btnOpen)    btnOpen.disabled = false;
    if (btnDisconn) btnDisconn.disabled = true;
  }
}

async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Firebase authentication is handled by auth-module.js
// Old local authentication functions removed (no longer needed with Firebase)
// NOTE: Use Firebase Auth API instead: firebase.auth().signInWithEmailAndPassword(email, password)

function logout() {
  currentUser = null;
  sessionStorage.removeItem(KEY_SESSION_USER);
  session = null;
  questions = [];
  records = {};
  showLoginOverlay();
}

function showLoginOverlay() {
  // Show login form by default (Firebase auth-module.js handles form switching)
  const loginFormArea = document.getElementById('login-form-area');
  const registerFormArea = document.getElementById('register-form-area');
  const resetFormArea = document.getElementById('reset-form-area');
  
  if (loginFormArea) loginFormArea.classList.remove('hidden');
  if (registerFormArea) registerFormArea.classList.add('hidden');
  if (resetFormArea) resetFormArea.classList.add('hidden');
  
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-overlay').classList.remove('hidden');
  
  // Clear form fields if they exist (use Firebase form element IDs)
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');
  const regPassword2 = document.getElementById('reg-password2');
  const resetEmail = document.getElementById('reset-email');
  
  if (loginEmail) loginEmail.value = '';
  if (loginPassword) loginPassword.value = '';
  if (regEmail) regEmail.value = '';
  if (regPassword) regPassword.value = '';
  if (regPassword2) regPassword2.value = '';
  if (resetEmail) resetEmail.value = '';
}

function hideLoginOverlay() {
  // Firebase認証後にデータを読み込む
  loadData();
  refreshFilterOptions();

  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('current-user-name').textContent = currentUser.displayName || currentUser.email;
}

function renderUsers() {
  const users = getUsers();
  const html = users.map(u => `
    <div class="user-row">
      <span class="user-row-name">${esc(u.name)}${u.id === currentUser.id ? ' <span class="badge-you">あなた</span>' : ''}</span>
      ${u.id === currentUser.id
        ? `<button class="btn btn-ghost btn-sm" onclick="showChangePwForm()">パスワード変更</button>`
        : `<button class="btn btn-danger btn-sm" onclick="deleteUserById('${esc(u.id)}')">\u524a\u9664</button>`}
    </div>
  `).join('');
  document.getElementById('user-list').innerHTML = html || '<p class="users-empty">ユーザーなし</p>';
}

function deleteUserById(id) {
  const users = getUsers();
  const user = users.find(u => u.id === id);
  if (!user) return;
  if (!confirm(`「${user.name}」を削除しますか？学習記録も削除されます。`)) return;
  saveUsers(users.filter(u => u.id !== id));
  localStorage.removeItem(`${KEY_RECORDS}_${id}`);
  renderUsers();
}

// ── パスワードリセット・変更 ─────────────────────────────────────

function showResetForm() {
  document.getElementById('reset-error').classList.add('hidden');
  document.getElementById('reset-fields').classList.add('hidden');
  document.getElementById('btn-do-reset').classList.add('hidden');
  document.getElementById('reset-pw').value = '';
  document.getElementById('reset-pw2').value = '';

  if (fileHandle) {
    // ファイル接続済み → 自動でユーザー一覧を表示
    document.getElementById('reset-verify-status').textContent = `接続中: ${fileHandle.name}`;
    document.getElementById('reset-verify-status').style.color = 'var(--success)';
    document.getElementById('btn-reset-open-file').classList.add('hidden');
    populateResetUserList(getUsers());
  } else {
    document.getElementById('reset-verify-status').textContent = '';
    document.getElementById('btn-reset-open-file').classList.remove('hidden');
  }

  document.getElementById('login-form-area').classList.add('hidden');
  document.getElementById('register-form-area').classList.add('hidden');
  document.getElementById('reset-form-area').classList.remove('hidden');
}

function populateResetUserList(users) {
  if (!users || users.length === 0) {
    document.getElementById('reset-verify-status').textContent = 'ユーザーが登録されていません';
    document.getElementById('reset-verify-status').style.color = 'var(--danger)';
    return;
  }
  // 一覧は表示せず、ユーザー名入力欄だけ開放
  document.getElementById('reset-fields').classList.remove('hidden');
  document.getElementById('btn-do-reset').classList.remove('hidden');
  document.getElementById('reset-username').value = '';
  document.getElementById('reset-username').focus();
}

async function resetPassword(name, pw, pw2) {
  const users = getUsers();
  const user = users.find(u => u.name === name);
  if (!user)         return 'ユーザーが見つかりません';
  if (pw.length < 4) return 'パスワードは4文字以上にしてください';
  if (pw !== pw2)    return 'パスワードが一致しません';
  user.pwHash = await hashPassword(pw);
  saveUsers(users);
  return null;
}

async function changePassword(oldPw, newPw, newPw2) {
  if (!currentUser)     return 'ログインが必要です';
  const users = getUsers();
  const user = users.find(u => u.id === currentUser.id);
  if (!user)            return 'ユーザー情報が見つかりません';
  if (await hashPassword(oldPw) !== user.pwHash) return '現在のパスワードが違います';
  if (newPw.length < 4) return '新しいパスワードは4文字以上にしてください';
  if (newPw !== newPw2) return '新しいパスワードが一致しません';
  user.pwHash = await hashPassword(newPw);
  saveUsers(users);
  return null;
}

function showChangePwForm() {
  document.getElementById('change-pw-old').value = '';
  document.getElementById('change-pw-new').value = '';
  document.getElementById('change-pw-new2').value = '';
  document.getElementById('change-pw-error').classList.add('hidden');
  document.getElementById('add-user-form').classList.add('hidden');
  document.getElementById('change-pw-form').classList.remove('hidden');
  document.getElementById('change-pw-old').focus();
}

function getRecord(limbId) {
  return records[limbId] || { correct: 0, wrong: 0 };
}

function addRecord(limbId, isCorrect) {
  if (!records[limbId]) records[limbId] = { correct: 0, wrong: 0 };
  if (isCorrect) records[limbId].correct++;
  else           records[limbId].wrong++;
  saveRecords();
}

function makeInlineRecordId(limbId, key) {
  return `${limbId}::${key}`;
}

/** 全肢をフラット化して返す */
function getAllLimbs(filterSubject = '', filterCategory = '', splitInlineForStats = false) {
  const limbs = [];
  for (const q of questions) {
    if (filterSubject  && q.subject  !== filterSubject)  continue;
    if (filterCategory && q.category !== filterCategory) continue;

    for (const limb of q.limbs) {
      if (splitInlineForStats) {
        const items = parseInlineOxItems(limb.text || '');
        const expected = getInlineOxExpectedAnswers(limb, items);
        if (items.length > 0 && expected.length === items.length) {
          for (const it of items) {
            limbs.push({
              ...limb,
              id: makeInlineRecordId(limb.id, it.key),
              text: `${limb.text}\n[判定対象: ${it.key}]`,
              questionId: q.id,
              subject: q.subject,
              category: q.category,
              questionText: q.questionText,
              source: q.source,
            });
          }
          continue;
        }
      }
      limbs.push({ ...limb, questionId: q.id, subject: q.subject, category: q.category, questionText: q.questionText, source: q.source });
    }
  }
  return limbs;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 苦手スコア（間違い多く、正答率低いほど高い） */
function weakScore(limbId) {
  const r = getRecord(limbId);
  const total = r.correct + r.wrong;
  if (total === 0) return 0;
  return r.wrong / total + r.wrong * 0.1;
}

function getSubjects() {
  return [...new Set(questions.map(q => q.subject).filter(Boolean))].sort();
}

function getCategories(subject = '') {
  return [...new Set(
    questions
      .filter(q => !subject || q.subject === subject)
      .map(q => q.category)
      .filter(Boolean)
  )].sort();
}

// source は "H17-1" / "R7-1" 形式。年度キー部分（h17/r7）を返す
function extractYearKey(source) {
  if (!source) return null;
  const m = source.match(/^([HhRr]\d+)/);
  return m ? m[1].toLowerCase() : null;
}

// 年度キー（h17, r7 等）を通し番号に変換（昇順ソート用）
function yearOrdinal(yk) {
  if (!yk) return 0;
  const k = yk.toLowerCase();
  const m = k.match(/^([hr])(\d+)$/);
  if (!m) return 0;
  if (m[1] === 'h') return parseInt(m[2], 10);          // h17 → 17
  return 100 + parseInt(m[2], 10);                       // r1 → 101, r7 → 107
}

// 年度キーを日本語表示に変換（h17 → "平成17年度"）
function yearLabel(yk) {
  if (!yk) return yk;
  const k = yk.toLowerCase();
  const m = k.match(/^([hr])(\d+)$/);
  if (!m) return yk.toUpperCase();
  return m[1] === 'h' ? `平成${m[2]}年度` : `令和${m[2]}年度`;
}

// 問題データに存在する年度キーを昇順で返す
function getAvailableYears() {
  const keys = [...new Set(
    questions.map(q => extractYearKey(q.source)).filter(Boolean)
  )];
  return keys.sort((a, b) => yearOrdinal(a) - yearOrdinal(b));
}

// ── ページ切り替え ────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  if (name === 'stats') renderStats();
  if (name === 'manage') { renderManage(); renderUsers(); updateFileStatus(); }
}

// ── フィルター選択肢の更新 ──────────────────────────────────
function refreshFilterOptions() {
  const subjects = getSubjects();

  // 学習ページ
  const fSubj = document.getElementById('filter-subject');
  const fCat  = document.getElementById('filter-category');
  const prevSubj = fSubj.value;
  fSubj.innerHTML = '<option value="">すべて</option>' + subjects.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  fSubj.value = prevSubj;

  const cats = getCategories(fSubj.value);
  fCat.innerHTML = '<option value="">すべて</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  // 管理ページ
  const mSubj = document.getElementById('manage-filter-subject');
  const mPrev = mSubj.value;
  mSubj.innerHTML = '<option value="">すべての科目</option>' + subjects.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  mSubj.value = mPrev;

  // 年度ドロップダウンをデータに存在する年度で埋める
  const years = getAvailableYears();
  const yearOptions = '<option value="">指定なし</option>' +
    years.map(y => `<option value="${y}">${y}（${yearLabel(y)}）</option>`).join('');
  ['filter-year-from', 'filter-year-to', 'manage-year-from', 'manage-year-to'].forEach(id => {
    const el = document.getElementById(id);
    const prev = el.value;
    el.innerHTML = yearOptions;
    if ([...el.options].some(o => o.value === prev)) el.value = prev;
  });

  // フォーム用 datalist
  document.getElementById('subject-list').innerHTML  = subjects.map(s => `<option value="${esc(s)}">`).join('');
  const allCats = getCategories();
  document.getElementById('category-list').innerHTML = allCats.map(c => `<option value="${esc(c)}">`).join('');
}

// ── 学習セッション ────────────────────────────────────────────
function startSession() {
  const subject  = document.getElementById('filter-subject').value;
  const category = document.getElementById('filter-category').value;
  const yearFrom = document.getElementById('filter-year-from').value;
  const yearTo   = document.getElementById('filter-year-to').value;
  const mode     = document.getElementById('filter-mode').value;

  let limbs = getAllLimbs(subject, category);

  // 年度フィルター
  if (yearFrom || yearTo) {
    limbs = limbs.filter(l => {
      const k = extractYearKey(l.source);
      if (!k) return true;
      const ord = yearOrdinal(k);
      if (yearFrom && ord < yearOrdinal(yearFrom)) return false;
      if (yearTo   && ord > yearOrdinal(yearTo))   return false;
      return true;
    });
  }

  if (mode === 'weak') {
    limbs = limbs.filter(l => getRecord(l.id).wrong > 0 || getRecord(l.id).correct === 0);
    limbs.sort((a, b) => weakScore(b.id) - weakScore(a.id));
  } else if (mode === 'unanswered') {
    limbs = limbs.filter(l => {
      const r = getRecord(l.id);
      return r.correct === 0 && r.wrong === 0;
    });
    limbs = shuffle(limbs);
  } else if (mode === 'wrong') {
    limbs = limbs.filter(l => getRecord(l.id).wrong > 0);
    limbs = shuffle(limbs);
  } else {
    limbs = shuffle(limbs);
  }

  if (limbs.length === 0) {
    alert('条件に合う肢がありません。');
    return;
  }

  session = { queue: limbs, index: 0 };
  document.getElementById('session-info').classList.remove('hidden');
  document.getElementById('btn-start').textContent = '最初から';
  renderCurrentLimb();
}

function endSession() {
  session = null;
  document.getElementById('session-info').classList.add('hidden');
  document.getElementById('btn-start').textContent = '学習開始';
  document.getElementById('limb-area').innerHTML = '<div id="empty-state" class="empty-state"><p>「学習開始」を押して問題を始めましょう。</p></div>';
}

function renderCurrentLimb() {
  if (!session) return;
  const { queue, index } = session;

  // 進捗更新
  document.getElementById('progress-text').textContent = `${index + 1} / ${queue.length}`;
  const pct = ((index + 1) / queue.length * 100).toFixed(1);
  document.getElementById('progress-bar').style.width = pct + '%';

  if (index >= queue.length) {
    endSession();
    showCompletionMessage();
    return;
  }

  const limb = queue[index];
  const rec  = getRecord(limb.id);
  const total = rec.correct + rec.wrong;
  const rate  = total > 0 ? Math.round(rec.correct / total * 100) : null;
  const inlineItems = parseInlineOxItems(limb.text || '');
  const inlineExpected = getInlineOxExpectedAnswers(limb, inlineItems);
  const isInlineOxQuestion = inlineItems.length > 0 && inlineExpected.length === inlineItems.length;
  const isChoiceQuestion = Array.isArray(limb.options) && limb.options.length >= 2;
  const answerButtonsHtml = isChoiceQuestion
    ? limb.options.map(opt => `<button class="btn-answer btn-choice" data-answer="${esc(opt)}">${esc(opt)}</button>`).join('')
    : `
        <button class="btn-answer btn-correct" data-answer="true">○ 正しい</button>
        <button class="btn-answer btn-wrong"   data-answer="false">× 誤り</button>
      `;
  const answerSectionHtml = isInlineOxQuestion
    ? `
      <div class="inline-next-area">
        <span id="inline-ox-status" class="inline-ox-status">すべての〇×を選択してください。</span>
        <button id="btn-inline-next" class="btn btn-primary" disabled>次の肢へ</button>
      </div>
    `
    : `
      <div class="answer-buttons">
        ${answerButtonsHtml}
      </div>
    `;

  const area = document.getElementById('limb-area');
  area.innerHTML = `
    <div class="limb-card card">
      ${limb.source ? `<div class="limb-meta"><span class="badge badge-source">${esc(limb.source)}</span> <span class="badge badge-subject">${esc(limb.subject)}</span>${limb.category ? ` <span class="badge badge-category">${esc(limb.category)}</span>` : ''}</div>` : `<div class="limb-meta"><span class="badge badge-subject">${esc(limb.subject)}</span>${limb.category ? ` <span class="badge badge-category">${esc(limb.category)}</span>` : ''}</div>`}
      ${limb.questionText ? `<div class="question-shared"><span class="question-label">問題文</span><span class="question-body">${esc(limb.questionText)}</span></div>` : ''}
      <div class="limb-text">${isInlineOxQuestion ? renderInlineOxText(limb.text) : esc(limb.text)}</div>
      <div class="limb-record">${rate !== null ? `正答率 ${rate}% (${rec.correct}○ ${rec.wrong}×)` : '未回答'}</div>
      ${answerSectionHtml}
    </div>
  `;

  if (isInlineOxQuestion) {
    const groups = [...area.querySelectorAll('.inline-ox-group')];
    const statusEl = document.getElementById('inline-ox-status');
    const nextBtn = document.getElementById('btn-inline-next');
    let finalized = false;
    let finalIsCorrect = false;

    const updateCompletion = () => {
      const answered = groups.every(g => !!g.dataset.selected);
      nextBtn.disabled = !answered;
      if (!answered) {
        statusEl.textContent = 'すべての〇×を選択してください。';
        return;
      }
      const userAnswers = groups.map(g => g.dataset.selected === 'true');
      finalIsCorrect = inlineExpected.every((ans, i) => ans === userAnswers[i]);
      statusEl.textContent = finalIsCorrect
        ? '全ての判定が一致しました。'
        : '一致していない箇所があります。';
    };

    const finalizeForRecord = () => {
      if (finalized) return;
      const answered = groups.every(g => !!g.dataset.selected);
      if (!answered) return;
      finalized = true;
    };

    groups.forEach((group, i) => {
      group.querySelectorAll('.inline-ox-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (group.dataset.locked === '1') return;
          group.querySelectorAll('.inline-ox-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          group.dataset.selected = btn.dataset.answer;
          group.dataset.index = String(i);
          group.dataset.locked = '1';
          group.querySelectorAll('.inline-ox-btn').forEach(b => { b.disabled = true; });
          const isThisCorrect = (btn.dataset.answer === 'true') === inlineExpected[i];
          addRecord(makeInlineRecordId(limb.id, inlineItems[i].key), isThisCorrect);
          const judgeEl = group.querySelector('.inline-judge-text');
          if (judgeEl) {
            judgeEl.textContent = isThisCorrect ? '正解' : '不正解';
            judgeEl.className = 'inline-judge-text ' + (isThisCorrect ? 'ok' : 'ng');
          }
          group.classList.remove('inline-correct', 'inline-wrong');
          group.classList.add(isThisCorrect ? 'inline-correct' : 'inline-wrong');
          showResult(
            limb,
            isThisCorrect,
            `<strong>${esc(inlineItems[i].key)} の判定</strong>：${isThisCorrect ? '正解' : '不正解'}`,
            { advanceSession: false }
          );
          updateCompletion();
        });
      });
    });

    nextBtn.addEventListener('click', () => {
      if (nextBtn.disabled) return;
      finalizeForRecord();
      session.index++;
      renderCurrentLimb();
    });

    updateCompletion();
    return;
  }

  area.querySelectorAll('.btn-answer').forEach(btn => {
    btn.addEventListener('click', () => {
      const userAnswer = btn.dataset.answer;
      const isCorrect = isChoiceQuestion
        ? userAnswer === limb.correctText
        : (userAnswer === 'true') === limb.correct;
      addRecord(limb.id, isCorrect);
      showResult(limb, isCorrect);
    });
  });
}

function showResult(limb, isCorrect, detailHtml = '', opts = {}) {
  const overlay = document.getElementById('modal-result');
  const btnNext = document.getElementById('btn-result-next');
  const advanceSession = opts.advanceSession !== false;
  overlay.dataset.advanceSession = advanceSession ? '1' : '0';
  btnNext.textContent = advanceSession ? '次の肢へ' : '閉じる';
  document.getElementById('result-icon').textContent        = isCorrect ? '✅ 正解！' : '❌ 不正解';
  document.getElementById('result-icon').className          = 'result-icon ' + (isCorrect ? 'correct' : 'wrong');
  const isChoiceQuestion = Array.isArray(limb.options) && limb.options.length >= 2;
  const inlineItems = parseInlineOxItems(limb.text || '');
  const inlineExpected = getInlineOxExpectedAnswers(limb, inlineItems);
  const isInlineOxQuestion = inlineItems.length > 0 && inlineExpected.length === inlineItems.length;
  const correctLabel = isChoiceQuestion
    ? (limb.correctText || '（未設定）')
    : isInlineOxQuestion
      ? '文中〇×（各所の判定）'
    : (limb.correct ? '正しい（○）' : '誤り（×）');
  const explanation  = limb.explanation || '（解説なし）';
  document.getElementById('result-explanation').innerHTML   =
    `<strong>正解：${correctLabel}</strong>${detailHtml ? `<br><br>${detailHtml}` : ''}<br><br>${esc(explanation)}`;
  overlay.classList.remove('hidden');
}

function showCompletionMessage() {
  const area = document.getElementById('limb-area');
  area.innerHTML = `<div class="empty-state card"><p>🎉 セッション完了！<br>お疲れさまでした。</p><button class="btn btn-primary" onclick="startSession()">もう一度</button></div>`;
}

// ── 問題管理ページ ────────────────────────────────────────────
function renderManage() {
  refreshFilterOptions();
  const keyword  = document.getElementById('search-manage').value.toLowerCase();
  const subject  = document.getElementById('manage-filter-subject').value;
  const yearFrom = document.getElementById('manage-year-from').value;
  const yearTo   = document.getElementById('manage-year-to').value;

  const filtered = questions.filter(q => {
    if (subject && q.subject !== subject) return false;
    if (keyword) {
      const hay = [q.questionText, q.subject, q.category, q.source, ...q.limbs.map(l => l.text + l.explanation)].join(' ').toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    if (yearFrom || yearTo) {
      const k = extractYearKey(q.source);
      if (k) {
        const ord = yearOrdinal(k);
        if (yearFrom && ord < yearOrdinal(yearFrom)) return false;
        if (yearTo   && ord > yearOrdinal(yearTo))   return false;
      }
    }
    return true;
  });

  const list = document.getElementById('question-list');
  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">問題がありません。「問題追加」から登録してください。</p>';
    updateBulkDeleteBtn();
    return;
  }

  list.innerHTML = filtered.map(q => {
    const limbsHtml = q.limbs.map((l, i) => {
      const rec   = getRecord(l.id);
      const total = rec.correct + rec.wrong;
      const rate  = total > 0 ? `${Math.round(rec.correct / total * 100)}%` : '-';
      const inlineItems = parseInlineOxItems(l.text || '');
      const inlineExpected = getInlineOxExpectedAnswers(l, inlineItems);
      const isInlineOxQuestion = inlineItems.length > 0 && inlineExpected.length === inlineItems.length;
      const isChoiceQuestion = Array.isArray(l.options) && l.options.length >= 2;
      const answerBadge = isInlineOxQuestion
        ? `<span class="limb-correct-badge badge-inline-ox">文中〇×</span>`
        : isChoiceQuestion
        ? `<span class="limb-correct-badge badge-choice">答: ${esc(l.correctText || '')}</span>`
        : `<span class="limb-correct-badge ${l.correct ? 'badge-o' : 'badge-x'}">${l.correct ? '○' : '×'}</span>`;
      return `<div class="manage-limb">
        <span class="limb-index">肢${i + 1}</span>
        ${answerBadge}
        <span class="limb-preview">${esc(l.text.slice(0, 60))}${l.text.length > 60 ? '…' : ''}</span>
        <span class="limb-stat">${rate}</span>
      </div>`;
    }).join('');
    return `<div class="manage-card card">
      <div class="manage-card-header">
        <div class="manage-card-left">
          <input type="checkbox" class="manage-chk" data-id="${q.id}" />
          <div class="manage-card-meta">
            <span class="badge badge-subject">${esc(q.subject)}</span>
            ${q.category ? `<span class="badge badge-category">${esc(q.category)}</span>` : ''}
            ${q.source   ? `<span class="badge badge-source">${esc(q.source)}</span>`   : ''}
          </div>
        </div>
        <div class="manage-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditModal('${q.id}')">✏️ 編集</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${q.id}')">🗑 削除</button>
        </div>
      </div>
      ${q.questionText ? `<div class="manage-question-text">${esc(q.questionText)}</div>` : ''}
      <div class="manage-limbs">${limbsHtml}</div>
    </div>`;
  }).join('');

  updateBulkDeleteBtn();
}

function deleteQuestion(id) {
  if (!confirm('この問題を削除しますか？')) return;
  questions = questions.filter(q => q.id !== id);
  saveQuestions();
  renderManage();
  refreshFilterOptions();
}

function bulkDeleteSelected() {
  const checked = document.querySelectorAll('.manage-chk:checked');
  if (checked.length === 0) return;
  if (!confirm(`選択した ${checked.length} 件の問題を削除しますか？`)) return;
  const ids = new Set([...checked].map(c => c.dataset.id));
  questions = questions.filter(q => !ids.has(q.id));
  saveQuestions();
  renderManage();
  refreshFilterOptions();
}

function updateBulkDeleteBtn() {
  const all     = document.querySelectorAll('.manage-chk');
  const checked = document.querySelectorAll('.manage-chk:checked');
  const count   = checked.length;
  const label   = document.getElementById('bulk-count-label');
  const btn     = document.getElementById('btn-bulk-delete');
  const chkAll  = document.getElementById('chk-select-all');
  label.textContent       = count > 0 ? `${count} 件選択中` : '';
  btn.disabled            = count === 0;
  chkAll.checked          = all.length > 0 && count === all.length;
  chkAll.indeterminate    = count > 0 && count < all.length;
}

// ── モーダル（問題追加・編集） ──────────────────────────────────
let editingQuestionId = null;

function openAddModal() {
  editingQuestionId = null;
  document.getElementById('modal-title').textContent = '問題を追加';
  document.getElementById('form-question').reset();
  document.getElementById('edit-question-id').value = '';
  resetLimbsEditor([{ text: '', correct: true, explanation: '', options: [], correctText: '', inlineOxWrong: [] }]);
  document.getElementById('modal-question').classList.remove('hidden');
}

function openEditModal(id) {
  const q = questions.find(q => q.id === id);
  if (!q) return;
  editingQuestionId = id;
  document.getElementById('modal-title').textContent = '問題を編集';
  document.getElementById('edit-question-id').value  = id;
  document.getElementById('input-subject').value     = q.subject || '';
  document.getElementById('input-category').value    = q.category || '';
  document.getElementById('input-source').value      = q.source || '';
  document.getElementById('input-question-text').value = q.questionText || '';
  resetLimbsEditor(q.limbs);
  document.getElementById('modal-question').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-question').classList.add('hidden');
}

function resetLimbsEditor(limbs) {
  const editor = document.getElementById('limbs-editor');
  editor.innerHTML = '';
  limbs.forEach(l => addLimbRow(editor, l));
}

function addLimbRow(editor, limb = { text: '', correct: true, explanation: '', options: [], correctText: '', inlineOxWrong: [] }) {
  const inlineItems = parseInlineOxItems(limb.text || '');
  const isInlineOxQuestion = inlineItems.length > 0 && (Array.isArray(limb.inlineOxWrong) || typeof limb.inlineOxWrong === 'string');
  const isChoiceQuestion = !isInlineOxQuestion && Array.isArray(limb.options) && limb.options.length > 0;
  const inlineWrongValue = Array.isArray(limb.inlineOxWrong)
    ? limb.inlineOxWrong.join(',')
    : (limb.inlineOxWrong || '');
  const div = document.createElement('div');
  div.className = 'limb-row';
  div.innerHTML = `
    <div class="limb-row-top">
      <select class="limb-answer-type-select">
        <option value="ox" ${!isChoiceQuestion && !isInlineOxQuestion ? 'selected' : ''}>○×問題</option>
        <option value="choice" ${isChoiceQuestion ? 'selected' : ''}>選択肢問題</option>
        <option value="inline-ox" ${isInlineOxQuestion ? 'selected' : ''}>文中〇×問題</option>
      </select>
      <select class="limb-correct-select ${isChoiceQuestion || isInlineOxQuestion ? 'hidden' : ''}">
        <option value="true"  ${limb.correct ? 'selected' : ''}>○ 正しい</option>
        <option value="false" ${!limb.correct ? 'selected' : ''}>× 誤り</option>
      </select>
      <textarea class="limb-text-input" rows="2" placeholder="肢の内容">${esc(limb.text)}</textarea>
      <button type="button" class="btn btn-danger btn-sm remove-limb-btn">✕</button>
    </div>
    <div class="limb-choice-settings ${isChoiceQuestion ? '' : 'hidden'}">
      <textarea class="limb-options-input" rows="2" placeholder="選択肢（1行に1つ）">${esc((limb.options || []).join('\n'))}</textarea>
      <select class="limb-correct-choice-select">
        <option value="">正解を選択</option>
      </select>
    </div>
    <div class="limb-inline-ox-settings ${isInlineOxQuestion ? '' : 'hidden'}">
      <p class="limb-inline-ox-note">本文中に「（①語句）〇×」の形で記載し、誤りの番号を指定します（例: ③,④）。</p>
      <input type="text" class="limb-inline-wrong-input" placeholder="誤りの番号（例: ③,④）" value="${esc(inlineWrongValue)}" />
    </div>
    <textarea class="limb-explanation-input" rows="2" placeholder="解説（任意）">${esc(limb.explanation || '')}</textarea>
  `;

  const answerTypeSelect = div.querySelector('.limb-answer-type-select');
  const correctSelect = div.querySelector('.limb-correct-select');
  const choiceSettings = div.querySelector('.limb-choice-settings');
  const inlineSettings = div.querySelector('.limb-inline-ox-settings');
  const optionsInput = div.querySelector('.limb-options-input');
  const correctChoiceSelect = div.querySelector('.limb-correct-choice-select');

  const syncChoiceOptions = () => {
    const options = optionsInput.value
      .split('\n')
      .map(v => v.trim())
      .filter(v => v);
    const prev = correctChoiceSelect.value || (limb.correctText || '');
    const uniqueOptions = [...new Set(options)];
    correctChoiceSelect.innerHTML =
      '<option value="">正解を選択</option>' +
      uniqueOptions.map(opt => `<option value="${esc(opt)}">${esc(opt)}</option>`).join('');
    if (uniqueOptions.includes(prev)) correctChoiceSelect.value = prev;
    limb.correctText = '';
  };

  syncChoiceOptions();
  optionsInput.addEventListener('input', syncChoiceOptions);

  answerTypeSelect.addEventListener('change', () => {
    const isChoice = answerTypeSelect.value === 'choice';
    const isInline = answerTypeSelect.value === 'inline-ox';
    correctSelect.classList.toggle('hidden', isChoice || isInline);
    choiceSettings.classList.toggle('hidden', !isChoice);
    inlineSettings.classList.toggle('hidden', !isInline);
    if (isChoice) syncChoiceOptions();
  });

  const syncInlineItemsHint = () => {
    const items = parseInlineOxItems(div.querySelector('.limb-text-input').value || '');
    const note = inlineSettings.querySelector('.limb-inline-ox-note');
    note.textContent = items.length > 0
      ? `検出された番号: ${items.map(it => it.key).join('、')}（誤りを入力）`
      : '本文中に「（①語句）〇×」の形で記載してください。';
  };
  div.querySelector('.limb-text-input').addEventListener('input', syncInlineItemsHint);
  syncInlineItemsHint();

  answerTypeSelect.dispatchEvent(new Event('change'));

  div.querySelector('.remove-limb-btn').addEventListener('click', () => {
    if (editor.querySelectorAll('.limb-row').length <= 1) { alert('肢は1つ以上必要です。'); return; }
    div.remove();
  });
  editor.appendChild(div);
}

function getLimbsFromEditor() {
  return [...document.querySelectorAll('#limbs-editor .limb-row')].map(row => {
    const answerType = row.querySelector('.limb-answer-type-select').value;
    const options = row.querySelector('.limb-options-input').value
      .split('\n')
      .map(v => v.trim())
      .filter(v => v);
    const correctText = row.querySelector('.limb-correct-choice-select').value.trim();
    const inlineOxWrong = parseInlineWrongKeys(row.querySelector('.limb-inline-wrong-input').value);
    return {
      id:          uid(),
      text:        row.querySelector('.limb-text-input').value.trim(),
      correct:     row.querySelector('.limb-correct-select').value === 'true',
      options:     answerType === 'choice' ? options : [],
      correctText: answerType === 'choice' ? correctText : '',
      inlineOxWrong: answerType === 'inline-ox' ? inlineOxWrong : [],
      explanation: row.querySelector('.limb-explanation-input').value.trim(),
    };
  });
}

function saveQuestion(e) {
  e.preventDefault();
  const subject      = document.getElementById('input-subject').value.trim();
  const category     = document.getElementById('input-category').value.trim();
  const source       = document.getElementById('input-source').value.trim();
  const questionText = document.getElementById('input-question-text').value.trim();

  if (!subject) { alert('試験・科目を入力してください。'); return; }

  const limbs = getLimbsFromEditor();
  if (limbs.some(l => !l.text)) { alert('肢の内容が空です。'); return; }
  if (limbs.some(l => l.options.length > 0 && l.options.length < 2)) {
    alert('選択肢問題は2つ以上の選択肢を入力してください。');
    return;
  }
  if (limbs.some(l => l.options.length > 0 && !l.correctText)) {
    alert('選択肢問題の正解を入力してください。');
    return;
  }
  if (limbs.some(l => l.options.length > 0 && !l.options.includes(l.correctText))) {
    alert('選択肢問題の正解は、選択肢に含まれる値を入力してください。');
    return;
  }
  if (limbs.some(l => l.inlineOxWrong && l.inlineOxWrong.length > 0 && parseInlineOxItems(l.text).length === 0)) {
    alert('文中〇×問題は、本文に「（①語句）〇×」の形式を含めてください。');
    return;
  }
  if (limbs.some(l => {
    if (!l.inlineOxWrong || l.inlineOxWrong.length === 0) return false;
    const keys = new Set(parseInlineOxItems(l.text).map(it => it.key));
    return l.inlineOxWrong.some(k => !keys.has(k));
  })) {
    alert('文中〇×問題の誤り番号が、本文中の番号と一致していません。');
    return;
  }

  if (editingQuestionId) {
    const idx = questions.findIndex(q => q.id === editingQuestionId);
    if (idx >= 0) {
      // 既存肢のIDを保持
      const oldLimbs = questions[idx].limbs;
      limbs.forEach((l, i) => {
        if (oldLimbs[i]) l.id = oldLimbs[i].id;
      });
      questions[idx] = { id: editingQuestionId, subject, category, source, questionText, limbs };
    }
  } else {
    questions.push({ id: uid(), subject, category, source, questionText, limbs });
  }

  saveQuestions();
  refreshFilterOptions();
  closeModal();
  renderManage();
}

function parseInlineWrongKeys(raw) {
  return String(raw || '')
    .split(/[、,\s]+/)
    .map(v => v.trim())
    .filter(v => v);
}

function parseInlineOxItems(text) {
  const src = String(text || '');
  const re = /（([^）]+)）(?:〇×\s*([^（\n]*?)|([^（]*?)〇×)/g;
  const items = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const body = m[1].trim();
    const tail = String(m[2] || m[3] || '').trim();
    const key = extractInlineOxKey(body, items.length);
    const rest = body.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, '').trim();
    if (!rest && !tail) continue;
    items.push({ key, body, tail });
  }
  return items;
}

function extractInlineOxKey(body, idx) {
  const m = String(body).match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/);
  if (m) return m[1];
  const k = String(body).match(/^([アイウエオ])/);
  if (k) return k[1];
  return String(idx + 1);
}

function getInlineOxExpectedAnswers(limb, items) {
  if (!items.length) return [];
  if (Array.isArray(limb.inlineOxAnswers) && limb.inlineOxAnswers.length >= items.length) {
    return limb.inlineOxAnswers.slice(0, items.length).map(v => !!v);
  }
  const wrong = new Set(Array.isArray(limb.inlineOxWrong)
    ? limb.inlineOxWrong
    : parseInlineWrongKeys(limb.inlineOxWrong));
  return items.map(it => !wrong.has(it.key));
}

function renderInlineOxText(text) {
  const src = String(text || '');
  const re = /（([^）]+)）(?:〇×\s*([^（\n]*?)|([^（]*?)〇×)/g;
  let out = '';
  let last = 0;
  let idx = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    out += esc(src.slice(last, m.index)).replace(/\n/g, '<br>');
    const body = m[1].trim();
    const tail = m[2] || m[3] || '';
    const key = extractInlineOxKey(body, idx);
    const rest = body.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, '').trim();
    if (!rest && !String(tail).trim()) {
      out += `（${esc(body)}）〇×`;
      last = re.lastIndex;
      continue;
    }
    const isKanaKeyOnly = /^[アイウエオ]$/.test(body);
    if (isKanaKeyOnly) {
      out += `<span class="inline-target">（${esc(body)}）</span>` +
        `<span class="inline-ox-group" data-index="${idx}">` +
          `<button class="inline-ox-btn" type="button" data-answer="true">○</button>` +
          `<button class="inline-ox-btn" type="button" data-answer="false">×</button>` +
          `<span class="inline-judge-text"></span>` +
        `</span>` + `<span class="inline-target-text">${esc(tail)}</span>`;
    } else {
      out += `<span class="inline-target">（${esc(body)}）${esc(tail)}</span>` +
        `<span class="inline-ox-group" data-index="${idx}">` +
          `<button class="inline-ox-btn" type="button" data-answer="true">○</button>` +
          `<button class="inline-ox-btn" type="button" data-answer="false">×</button>` +
          `<span class="inline-judge-text"></span>` +
        `</span>`;
    }
    last = re.lastIndex;
    idx++;
  }
  out += esc(src.slice(last)).replace(/\n/g, '<br>');
  return out;
}

function buildInlineOxResultHtml(items, expected, userAnswers) {
  return items.map((it, i) => {
    const ans = expected[i] ? '○' : '×';
    const you = userAnswers[i] ? '○' : '×';
    const ok = expected[i] === userAnswers[i];
    return `${esc(it.key)}: 正解 ${ans} / あなた ${you} ${ok ? '✓' : '✗'}`;
  }).join('<br>');
}

// ── インポート / エクスポート ──────────────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `limb_questions_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  return importJSONFiles([file]);
}

function importJSONFiles(files) {
  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error(`${file.name}：配列形式のJSONが必要です。`);
        resolve({ name: file.name, data });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error(`${file.name}：ファイルの読み込みに失敗しました。`));
    reader.readAsText(file);
  });

  Promise.all(files.map(readFile)).then((results) => {
    const merged = [...questions];
    let totalNew = 0;
    let totalUpdated = 0;
    for (const { data } of results) {
      for (const q of data) {
        const idx = merged.findIndex(m => m.id === q.id);
        if (idx === -1) {
          merged.push(q);
          totalNew++;
        } else {
          merged[idx] = q;
          totalUpdated++;
        }
      }
    }
    questions = merged;
    saveQuestions();
    refreshFilterOptions();
    renderManage();
    const fileNames = results.map(r => r.name).join('、');
    alert(`インポート完了：${files.length}ファイル（${fileNames}）から新規${totalNew}問、更新${totalUpdated}問を反映しました。`);
  }).catch((err) => {
    alert('JSONの読み込みに失敗しました：' + err.message);
  });
}

// ── 成績ページ ────────────────────────────────────────────────
function renderStats() {
  const allLimbs = getAllLimbs('', '', true);
  let total = 0, correct = 0;

  for (const limb of allLimbs) {
    const r = getRecord(limb.id);
    total   += r.correct + r.wrong;
    correct += r.correct;
  }

  const rate = total > 0 ? Math.round(correct / total * 100) : null;
  const answered = allLimbs.filter(l => { const r = getRecord(l.id); return r.correct + r.wrong > 0; });
  const weak     = allLimbs.filter(l => { const r = getRecord(l.id); return r.wrong > r.correct; });

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-rate').textContent   = rate !== null ? rate + '%' : '-%';
  document.getElementById('stat-limbs').textContent  = answered.length;
  document.getElementById('stat-weak').textContent   = weak.length;

  // 科目別
  const subjectMap = {};
  for (const limb of allLimbs) {
    const r = getRecord(limb.id);
    if (!subjectMap[limb.subject]) subjectMap[limb.subject] = { correct: 0, wrong: 0 };
    subjectMap[limb.subject].correct += r.correct;
    subjectMap[limb.subject].wrong   += r.wrong;
  }
  const subjectHtml = Object.entries(subjectMap).map(([subj, r]) => {
    const t = r.correct + r.wrong;
    const rt = t > 0 ? Math.round(r.correct / t * 100) : 0;
    return `<div class="subject-stat-row">
      <span class="subject-name">${esc(subj)}</span>
      <div class="subject-bar-outer"><div class="subject-bar-inner" style="width:${rt}%"></div></div>
      <span class="subject-rate">${t > 0 ? rt + '%' : '-'}</span>
    </div>`;
  }).join('');
  document.getElementById('subject-stats').innerHTML = subjectHtml || '<p>データなし</p>';

  // 苦手肢トップ10
  const weakSorted = allLimbs
    .filter(l => getRecord(l.id).wrong > 0)
    .sort((a, b) => weakScore(b.id) - weakScore(a.id))
    .slice(0, 10);

  const weakHtml = weakSorted.map((limb, i) => {
    const r = getRecord(limb.id);
    const t = r.correct + r.wrong;
    const rt = Math.round(r.correct / t * 100);
    return `<div class="weak-limb-row">
      <span class="weak-rank">${i + 1}</span>
      <div class="weak-limb-info">
        <div class="weak-limb-text">${esc(limb.text.slice(0, 80))}${limb.text.length > 80 ? '…' : ''}</div>
        <div class="weak-limb-meta">${esc(limb.subject)}${limb.category ? ' / ' + esc(limb.category) : ''}　 正答率 ${rt}% (${r.correct}○ ${r.wrong}×)</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('weak-limbs-list').innerHTML = weakHtml || '<p>苦手肢なし</p>';
}

// ── XSSエスケープ ────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── イベント登録 ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── ファイルストレージ初期化 ──────────────────────────────
  await initFileStorage();

  // ── 配布済みデータの同期 ────────────────────────────────
  await syncBundledQuestions();

  // ── 認証の初期化 ──────────────────────────────────────────
  try {
    const saved = sessionStorage.getItem(KEY_SESSION_USER);
    if (saved) currentUser = JSON.parse(saved);
  } catch { currentUser = null; }

  if (currentUser) {
    loadData();
    refreshFilterOptions();
    hideLoginOverlay();
  } else {
    showLoginOverlay();
  }

  // ログイン・登録は auth-module.js で処理
  // Firebase Authentication のイベントハンドラは auth-module.js で設定済み

  // フォーム切替は auth-module.js で処理 (switchAuthForm())

  // パスワードリセットは Firebase 版 UI/auth-module.js 側で処理

  // ログアウト
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (!confirm('ログアウトしますか？')) return;
    logout();
  });

  // ユーザー追加フォーム
  document.getElementById('btn-show-add-user').addEventListener('click', () => {
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pw').value = '';
    document.getElementById('new-user-pw2').value = '';
    document.getElementById('add-user-error').classList.add('hidden');
    document.getElementById('add-user-form').classList.remove('hidden');
    document.getElementById('new-user-name').focus();
  });
  document.getElementById('btn-cancel-add-user').addEventListener('click', () => {
    document.getElementById('add-user-form').classList.add('hidden');
  });
  document.getElementById('btn-add-user').addEventListener('click', async () => {
    const name  = document.getElementById('new-user-name').value.trim();
    const pw    = document.getElementById('new-user-pw').value;
    const pw2   = document.getElementById('new-user-pw2').value;
    const errEl = document.getElementById('add-user-error');
    errEl.classList.add('hidden');
    if (!name)         { errEl.textContent = 'ユーザー名を入力してください'; errEl.classList.remove('hidden'); return; }
    if (pw.length < 4) { errEl.textContent = 'パスワードは4文字以上'; errEl.classList.remove('hidden'); return; }
    if (pw !== pw2)    { errEl.textContent = 'パスワードが一致しません'; errEl.classList.remove('hidden'); return; }
    const users = getUsers();
    if (users.find(u => u.name === name)) { errEl.textContent = 'そのユーザー名は既に使用中です'; errEl.classList.remove('hidden'); return; }
    users.push({ id: uid(), name, pwHash: await hashPassword(pw) });
    saveUsers(users);
    document.getElementById('add-user-form').classList.add('hidden');
    renderUsers();
  });

  // パスワード変更
  document.getElementById('btn-change-pw-cancel').addEventListener('click', () => {
    document.getElementById('change-pw-form').classList.add('hidden');
  });
  document.getElementById('btn-change-pw-do').addEventListener('click', async () => {
    const oldPw  = document.getElementById('change-pw-old').value;
    const newPw  = document.getElementById('change-pw-new').value;
    const newPw2 = document.getElementById('change-pw-new2').value;
    const errEl  = document.getElementById('change-pw-error');
    errEl.classList.add('hidden');
    const err = await changePassword(oldPw, newPw, newPw2);
    if (err) {
      errEl.textContent = err;
      errEl.classList.remove('hidden');
    } else {
      document.getElementById('change-pw-form').classList.add('hidden');
      alert('パスワードを変更しました。');
    }
  });

  // ── ファイルストレージ ──────────────────────────────────────
  document.getElementById('btn-new-data-file').addEventListener('click', async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'limb_data.json',
        types: [{ description: 'JSONデータ', accept: { 'application/json': ['.json'] } }],
      });
      fileHandle = handle; pendingHandle = null;
      await IDB.set('dataFileHandle', handle);
      await writeToFile();
      updateFileStatus();
    } catch (e) { if (e.name !== 'AbortError') alert('ファイルの作成に失敗しました: ' + e.message); }
  });
  document.getElementById('btn-open-data-file').addEventListener('click', async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSONデータ', accept: { 'application/json': ['.json'] } }],
      });
      await connectHandle(handle);
      loadData(); refreshFilterOptions(); updateFileStatus();
      if (currentUser) { renderManage(); renderUsers(); }
    } catch (e) { if (e.name !== 'AbortError') alert('ファイルを開けませんでした: ' + e.message); }
  });
  document.getElementById('btn-reconnect-file').addEventListener('click', async () => {
    if (!pendingHandle) return;
    try {
      const perm = await pendingHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await connectHandle(pendingHandle);
        loadData(); refreshFilterOptions(); updateFileStatus();
        if (currentUser) { renderManage(); renderUsers(); }
      }
    } catch (e) { alert('再接続に失敗しました: ' + e.message); }
  });
  document.getElementById('btn-disconnect-file').addEventListener('click', async () => {
    if (!confirm('ファイルとの接続を解除しますか？\nファイル本体は削除されません。')) return;
    fileHandle = null; pendingHandle = null;
    await IDB.del('dataFileHandle');
    updateFileStatus();
  });

  // ── 既存のイベント ────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  // 学習ページ
  document.getElementById('btn-start').addEventListener('click', startSession);
  document.getElementById('btn-end-session').addEventListener('click', endSession);

  document.getElementById('filter-subject').addEventListener('change', (e) => {
    const cats = getCategories(e.target.value);
    const fCat = document.getElementById('filter-category');
    fCat.innerHTML = '<option value="">すべて</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  });

  // 結果モーダル
  document.getElementById('btn-result-next').addEventListener('click', () => {
    const modal = document.getElementById('modal-result');
    const shouldAdvance = modal.dataset.advanceSession !== '0';
    modal.classList.add('hidden');
    if (shouldAdvance && session) {
      session.index++;
      renderCurrentLimb();
    }
  });

  // 問題管理
  document.getElementById('btn-add-question').addEventListener('click', openAddModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  document.getElementById('form-question').addEventListener('submit', saveQuestion);
  document.getElementById('btn-add-limb').addEventListener('click', () => {
    addLimbRow(document.getElementById('limbs-editor'));
  });
  document.getElementById('search-manage').addEventListener('input', renderManage);
  document.getElementById('manage-filter-subject').addEventListener('change', renderManage);
  document.getElementById('manage-year-from').addEventListener('change', renderManage);
  document.getElementById('manage-year-to').addEventListener('change', renderManage);

  // 全選択チェックボックス
  document.getElementById('chk-select-all').addEventListener('change', e => {
    document.querySelectorAll('.manage-chk').forEach(c => { c.checked = e.target.checked; });
    updateBulkDeleteBtn();
  });
  // 個別チェック変化（イベント委譲）
  document.getElementById('question-list').addEventListener('change', e => {
    if (e.target.classList.contains('manage-chk')) updateBulkDeleteBtn();
  });
  document.getElementById('btn-bulk-delete').addEventListener('click', bulkDeleteSelected);

  // インポート / エクスポート
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').value = '';
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) importJSONFiles(files);
  });

  // モーダル外クリックで閉じる
  document.getElementById('modal-question').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-question')) closeModal();
  });
  document.getElementById('modal-result').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-result')) {
      const modal = document.getElementById('modal-result');
      const shouldAdvance = modal.dataset.advanceSession !== '0';
      modal.classList.add('hidden');
      if (shouldAdvance && session) { session.index++; renderCurrentLimb(); }
    }
  });

  // 成績リセット
  document.getElementById('btn-reset-stats').addEventListener('click', () => {
    if (!confirm('すべての成績をリセットしますか？')) return;
    records = {};
    saveRecords();
    renderStats();
  });
});
