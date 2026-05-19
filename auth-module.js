// Firebase Authentication Module
// Firebase 認証と Firestore データベースの連携

// ===== ユーティリティ関数 =====
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.add('hidden');
}

// ===== ログイン処理 =====
async function handleEmailLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) {
    showError('login-error', 'メールアドレスとパスワードを入力してください');
    return;
  }

  try {
    hideError('login-error');
    document.getElementById('btn-login').disabled = true;
    
    const auth = firebase.auth();
    const result = await auth.signInWithEmailAndPassword(email, password);
    console.log('✓ ログイン成功:', result.user.email);
  } catch (error) {
    console.error('✗ ログイン失敗:', error.code);
    let msg = 'ログインに失敗しました';
    if (error.code === 'auth/user-not-found') msg = 'ユーザーが見つかりません';
    if (error.code === 'auth/wrong-password') msg = 'パスワードが正しくありません';
    if (error.code === 'auth/invalid-email') msg = 'メールアドレスが無効です';
    showError('login-error', msg);
  } finally {
    document.getElementById('btn-login').disabled = false;
  }
}

// ===== 新規登録処理 =====
async function handleRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const password2 = document.getElementById('reg-password2').value.trim();

  if (!email || !password || !password2) {
    showError('reg-error', 'すべてのフィールドを入力してください');
    return;
  }

  if (password !== password2) {
    showError('reg-error', 'パスワードが一致しません');
    return;
  }

  if (password.length < 6) {
    showError('reg-error', 'パスワードは6文字以上である必要があります');
    return;
  }

  try {
    hideError('reg-error');
    document.getElementById('btn-register').disabled = true;
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    const result = await auth.createUserWithEmailAndPassword(email, password);
    console.log('✓ ユーザー作成成功:', result.user.email);
    
    // Firestore に初期ユーザーデータを作成
    await db.collection('users').doc(result.user.uid).set({
      email: email,
      createdAt: new Date(),
      displayName: email.split('@')[0]
    });
    
    console.log('✓ Firestore にユーザードキュメント作成');
  } catch (error) {
    console.error('✗ ユーザー作成失敗:', error.code);
    let msg = 'ユーザー作成に失敗しました';
    if (error.code === 'auth/email-already-in-use') msg = 'このメールアドレスは既に使用されています';
    if (error.code === 'auth/invalid-email') msg = 'メールアドレスが無効です';
    if (error.code === 'auth/weak-password') msg = 'パスワードが弱すぎます';
    showError('reg-error', msg);
  } finally {
    document.getElementById('btn-register').disabled = false;
  }
}

// ===== パスワードリセット処理 =====
async function handlePasswordReset() {
  const email = document.getElementById('reset-email').value.trim();

  if (!email) {
    showError('reset-error', 'メールアドレスを入力してください');
    return;
  }

  try {
    hideError('reset-error');
    document.getElementById('btn-do-reset').disabled = true;
    
    const auth = firebase.auth();
    await auth.sendPasswordResetEmail(email);
    console.log('✓ パスワードリセットメール送信');
    document.getElementById('reset-success').classList.remove('hidden');
    
    // 3秒後にログインフォームに戻す
    setTimeout(() => {
      switchAuthForm('login');
    }, 3000);
  } catch (error) {
    console.error('✗ パスワードリセット失敗:', error.code);
    let msg = 'パスワードリセットに失敗しました';
    if (error.code === 'auth/user-not-found') msg = 'このメールアドレスのユーザーが見つかりません';
    if (error.code === 'auth/invalid-email') msg = 'メールアドレスが無効です';
    showError('reset-error', msg);
  } finally {
    document.getElementById('btn-do-reset').disabled = false;
  }
}

// ===== Google ログイン処理 =====
async function handleGoogleSignIn() {
  try {
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    console.log('✓ Google ログイン成功:', result.user.email);
    
    // 新規ユーザーの場合、Firestore に情報を保存
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(result.user.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      await userRef.set({
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        createdAt: new Date()
      });
    }
  } catch (error) {
    console.error('✗ Google ログイン失敗:', error.code);
    if (error.code !== 'auth/popup-closed-by-user') {
      showError('login-error', 'Google ログインに失敗しました');
    }
  }
}

// ===== ログアウト処理 =====
async function handleLogout() {
  try {
    const auth = firebase.auth();
    await auth.signOut();
    console.log('✓ ログアウト');
  } catch (error) {
    console.error('✗ ログアウト失敗:', error);
  }
}

// ===== 認証フォーム切り替え =====
function switchAuthForm(form) {
  document.getElementById('login-form-area').classList.toggle('hidden', form !== 'login');
  document.getElementById('register-form-area').classList.toggle('hidden', form !== 'register');
  document.getElementById('reset-form-area').classList.toggle('hidden', form !== 'reset');
  
  // エラーメッセージをクリア
  hideError('login-error');
  hideError('reg-error');
  hideError('reset-error');
  document.getElementById('reset-success').classList.add('hidden');
}

// ===== 認証状態の監視 =====
function setupAuthStateListener() {
  const auth = firebase.auth();
  
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log('✓ ユーザーはログイン中:', user.email);
      
      // ログインオーバーレイを隠す
      document.getElementById('login-overlay').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      
      // グローバル変数にユーザー情報を保存
      window.currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0]
      };
      
      // 問題データを読み込む
        if (typeof loadData === 'function') loadData();
        if (typeof refreshFilterOptions === 'function') refreshFilterOptions();
        
        // ユーザー表示を更新
      const userDisplayEl = document.getElementById('user-display-name');
      if (userDisplayEl) {
        userDisplayEl.textContent = window.currentUser.displayName;
      }
    } else {
      console.log('✗ ユーザーはログインしていません');
      
      // アプリを隠す、ログイン画面を表示
      document.getElementById('app').classList.add('hidden');
      document.getElementById('login-overlay').classList.remove('hidden');
      
      // ログインフォームにリセット
      switchAuthForm('login');
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
      
      // グローバル変数をクリア
      window.currentUser = null;
    }
  });
}

// ===== イベントリスナー登録 =====
document.addEventListener('DOMContentLoaded', () => {
  // Firebase 初期化を待つ
  if (!window.firebaseInitialized) {
    console.warn('⚠ Firebase が初期化されていません');
    // 短い遅延後に再試行
    setTimeout(() => setupAuthStateListener(), 1000);
  } else {
    setupAuthStateListener();
  }

  // ログインボタン
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', handleEmailLogin);
  }

  // 登録ボタン
  const btnRegister = document.getElementById('btn-register');
  if (btnRegister) {
    btnRegister.addEventListener('click', handleRegister);
  }

  // パスワードリセットボタン
  const btnReset = document.getElementById('btn-do-reset');
  if (btnReset) {
    btnReset.addEventListener('click', handlePasswordReset);
  }

  // フォーム切り替えボタン
  const btnShowRegister = document.getElementById('btn-show-register');
  if (btnShowRegister) {
    btnShowRegister.addEventListener('click', () => switchAuthForm('register'));
  }

  const btnShowReset = document.getElementById('btn-show-reset');
  if (btnShowReset) {
    btnShowReset.addEventListener('click', () => switchAuthForm('reset'));
  }

  const btnShowLoginFromRegister = document.getElementById('btn-show-login');
  if (btnShowLoginFromRegister) {
    btnShowLoginFromRegister.addEventListener('click', () => switchAuthForm('login'));
  }

  const btnShowLoginFromReset = document.getElementById('btn-show-login-from-reset');
  if (btnShowLoginFromReset) {
    btnShowLoginFromReset.addEventListener('click', () => switchAuthForm('login'));
  }

  // ログアウトボタン
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }

  // Google ログインボタン（Google Sign-In ライブラリが読み込まれたら初期化）
  if (window.google && window.google.accounts && window.google.accounts.id) {
    initGoogleSignIn();
  } else {
    // Google Sign-In ライブラリが遅延読み込みされた場合
    const checkGoogle = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id && !window.googleSignInInitialized) {
        initGoogleSignIn();
        clearInterval(checkGoogle);
      }
    }, 100);
  }
});

// Google Sign-In の初期化
function initGoogleSignIn() {
  if (window.googleSignInInitialized) return;
  window.googleSignInInitialized = true;

  try {
    // 注意：Google Sign-In が不要な場合は、このセクション全体をコメントアウトしてください
    // Google Cloud Console から取得した Client ID に置き換えてください
    const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
    
    // Client ID が設定されていない場合はスキップ
    if (GOOGLE_CLIENT_ID.includes("YOUR_")) {
      console.warn('⚠ Google Sign-In が設定されていません（Google Client ID が必要）');
      return;
    }
    
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignInCallback
    });

    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
      google.accounts.id.renderButton(googleBtn, { theme: 'outline', size: 'large' });
    }
  } catch (error) {
    console.warn('Google Sign-In initialization skipped:', error);
  }
}

// Google ログインコールバック
async function handleGoogleSignInCallback(response) {
  try {
    const auth = firebase.auth();
    // Google の ID トークンをFirebase に渡す
    const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
    await auth.signInWithCredential(credential);
    console.log('✓ Google ログイン成功');
  } catch (error) {
    console.error('✗ Google ログイン失敗:', error);
    showError('login-error', 'Google ログインに失敗しました');
  }
}

// メールアドレス入力時にEnter キーでログイン
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (!document.getElementById('login-form-area').classList.contains('hidden')) {
      handleEmailLogin();
    } else if (!document.getElementById('register-form-area').classList.contains('hidden')) {
      handleRegister();
    } else if (!document.getElementById('reset-form-area').classList.contains('hidden')) {
      handlePasswordReset();
    }
  }
});

console.log('✓ Auth module loaded');

// ===== ログイン処理 =====
async function handleEmailLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) {
    showError('login-error', 'メールアドレスとパスワードを入力してください');
    return;
  }

  try {
    hideError('login-error');
    document.getElementById('btn-login').disabled = true;
    
    const result = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('✓ ログイン成功:', result.user.email);
    // ログイン成功時の処理は、onAuthStateChanged リスナーで実行される
  } catch (error) {
    console.error('✗ ログイン失敗:', error.code);
    let msg = 'ログインに失敗しました';
    if (error.code === 'auth/user-not-found') msg = 'ユーザーが見つかりません';
    if (error.code === 'auth/wrong-password') msg = 'パスワードが正しくありません';
    if (error.code === 'auth/invalid-email') msg = 'メールアドレスが無効です';
    showError('login-error', msg);
  } finally {
    document.getElementById('btn-login').disabled = false;
  }
}

// ===== 新規登録処理 =====
async function handleRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const password2 = document.getElementById('reg-password2').value.trim();

  if (!email || !password || !password2) {
    showError('reg-error', 'すべてのフィールドを入力してください');
    return;
  }

  if (password !== password2) {
    showError('reg-error', 'パスワードが一致しません');
    return;
  }

  if (password.length < 6) {
    showError('reg-error', 'パスワードは6文字以上である必要があります');
    return;
  }

  try {
    hideError('reg-error');
    document.getElementById('btn-register').disabled = true;
    
    const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
    console.log('✓ ユーザー作成成功:', result.user.email);
    
    // Firestore に初期ユーザーデータを作成
    await db.collection('users').doc(result.user.uid).set({
      email: email,
      createdAt: new Date(),
      displayName: email.split('@')[0]
    });
    
    console.log('✓ Firestore にユーザードキュメント作成');
    // ユーザー作成成功時の処理は、onAuthStateChanged リスナーで実行される
  } catch (error) {
    console.error('✗ ユーザー作成失敗:', error.code);
    let msg = 'ユーザー作成に失敗しました';
    if (error.code === 'auth/email-already-in-use') msg = 'このメールアドレスは既に使用されています';
    if (error.code === 'auth/invalid-email') msg = 'メールアドレスが無効です';
    if (error.code === 'auth/weak-password') msg = 'パスワードが弱すぎます';
    showError('reg-error', msg);
  } finally {
    document.getElementById('btn-register').disabled = false;
  }
}

// ===== パスワードリセット処理 =====
async function handlePasswordReset() {
  const email = document.getElementById('reset-email').value.trim();

  if (!email) {
    showError('reset-error', 'メールアドレスを入力してください');
    return;
  }

  try {
    hideError('reset-error');
    document.getElementById('btn-do-reset').disabled = true;
    
    await firebase.auth().sendPasswordResetEmail(email);
    console.log('✓ パスワードリセットメール送信');
    document.getElementById('reset-success').classList.remove('hidden');
    
    // 3秒後にログインフォームに戻す
    setTimeout(() => {
      switchAuthForm('login');
    }, 3000);
  } catch (error) {
    console.error('✗ パスワードリセット失敗:', error.code);
    let msg = 'パスワードリセットに失敗しました';
    if (error.code === 'auth/user-not-found') msg = 'このメールアドレスのユーザーが見つかりません';
    if (error.code === 'auth/invalid-email') msg = 'メールアドレスが無効です';
    showError('reset-error', msg);
  } finally {
    document.getElementById('btn-do-reset').disabled = false;
  }
}

// ===== Google ログイン処理 =====
async function handleGoogleSignIn() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    console.log('✓ Google ログイン成功:', result.user.email);
    
    // 新規ユーザーの場合、Firestore に情報を保存
    const userRef = db.collection('users').doc(result.user.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      await userRef.set({
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        createdAt: new Date()
      });
    }
  } catch (error) {
    console.error('✗ Google ログイン失敗:', error.code);
    if (error.code !== 'auth/popup-closed-by-user') {
      showError('login-error', 'Google ログインに失敗しました');
    }
  }
}

// ===== ログアウト処理 =====
async function handleLogout() {
  try {
    await firebase.auth().signOut();
    console.log('✓ ログアウト');
  } catch (error) {
    console.error('✗ ログアウト失敗:', error);
  }
}

// ===== 認証フォーム切り替え =====
function switchAuthForm(form) {
  document.getElementById('login-form-area').classList.toggle('hidden', form !== 'login');
  document.getElementById('register-form-area').classList.toggle('hidden', form !== 'register');
  document.getElementById('reset-form-area').classList.toggle('hidden', form !== 'reset');
  
  // エラーメッセージをクリア
  hideError('login-error');
  hideError('reg-error');
  hideError('reset-error');
  document.getElementById('reset-success').classList.add('hidden');
}

// ===== 認証状態の監視 =====
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    console.log('✓ ユーザーはログイン中:', user.email);
    
    // ログインオーバーレイを隠す
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // グローバル変数にユーザー情報を保存
    window.currentUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0]
    };
    
    // 問題データを読み込む
        if (typeof loadData === 'function') loadData();
        if (typeof refreshFilterOptions === 'function') refreshFilterOptions();
        
        // ユーザー表示を更新
    const userDisplayEl = document.getElementById('user-display-name');
    if (userDisplayEl) {
      userDisplayEl.textContent = window.currentUser.displayName;
    }
    
    // ローカルストレージから成績を Firestore に同期（初回ログイン時など）
    // TODO: 同期ロジック
  } else {
    console.log('✗ ユーザーはログインしていません');
    
    // アプリを隠す、ログイン画面を表示
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    
    // ログインフォームにリセット
    switchAuthForm('login');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    // グローバル変数をクリア
    window.currentUser = null;
  }
});

// ===== イベントリスナー登録 =====
document.addEventListener('DOMContentLoaded', () => {
  // ログインボタン
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', handleEmailLogin);
  }

  // 登録ボタン
  const btnRegister = document.getElementById('btn-register');
  if (btnRegister) {
    btnRegister.addEventListener('click', handleRegister);
  }

  // パスワードリセットボタン
  const btnReset = document.getElementById('btn-do-reset');
  if (btnReset) {
    btnReset.addEventListener('click', handlePasswordReset);
  }

  // フォーム切り替えボタン
  const btnShowRegister = document.getElementById('btn-show-register');
  if (btnShowRegister) {
    btnShowRegister.addEventListener('click', () => switchAuthForm('register'));
  }

  const btnShowReset = document.getElementById('btn-show-reset');
  if (btnShowReset) {
    btnShowReset.addEventListener('click', () => switchAuthForm('reset'));
  }

  const btnShowLoginFromRegister = document.getElementById('btn-show-login');
  if (btnShowLoginFromRegister) {
    btnShowLoginFromRegister.addEventListener('click', () => switchAuthForm('login'));
  }

  const btnShowLoginFromReset = document.getElementById('btn-show-login-from-reset');
  if (btnShowLoginFromReset) {
    btnShowLoginFromReset.addEventListener('click', () => switchAuthForm('login'));
  }

  // Google ログインボタン（Google Sign-In ライブラリが読み込まれたら初期化）
  if (window.google) {
    initGoogleSignIn();
  } else {
    // Google Sign-In ライブラリが遅延読み込みされた場合
    window.addEventListener('load', () => {
      if (window.google && !window.googleSignInInitialized) {
        initGoogleSignIn();
      }
    });
  }
});

// Google Sign-In の初期化
function initGoogleSignIn() {
  if (window.googleSignInInitialized) return;
  window.googleSignInInitialized = true;

  try {
    google.accounts.id.initialize({
      client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
      callback: handleGoogleSignInCallback
    });

    google.accounts.id.renderButton(
      document.getElementById('google-login-btn'),
      { theme: 'outline', size: 'large' }
    );
  } catch (error) {
    console.warn('Google Sign-In initialization skipped:', error);
  }
}

// Google ログインコールバック
async function handleGoogleSignInCallback(response) {
  try {
    // Google の ID トークンをFirebase に渡す
    const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
    await firebase.auth().signInWithCredential(credential);
    console.log('✓ Google ログイン成功');
  } catch (error) {
    console.error('✗ Google ログイン失敗:', error);
    showError('login-error', 'Google ログインに失敗しました');
  }
}

// メールアドレス入力時にEnter キーでログイン
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.getElementById('login-form-area').classList.contains('hidden') === false) {
      handleEmailLogin();
    } else if (document.getElementById('register-form-area').classList.contains('hidden') === false) {
      handleRegister();
    } else if (document.getElementById('reset-form-area').classList.contains('hidden') === false) {
      handlePasswordReset();
    }
  }
});

console.log('✓ Auth module loaded');
