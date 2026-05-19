// Firebase Configuration
// プロジェクト ID: chisatsu-exam-practice
const firebaseConfig = {
  apiKey: "AIzaSyALhMSjU_qObceADtp27EcjFVmRBrvZlFs",
  authDomain: "chisatsu-exam-practice.firebaseapp.com",
  projectId: "chisatsu-exam-practice",
  storageBucket: "chisatsu-exam-practice.firebasestorage.app",
  messagingSenderId: "487053227761",
  appId: "1:487053227761:web:12437a4c5dc89804791b50",
  measurementId: "G-W2X48FK30S"
};

// Firebase を初期化（アプリ起動時に実行される）
if (!window.firebaseInitialized) {
  try {
    firebase.initializeApp(firebaseConfig);
    window.firebaseInitialized = true;
    console.log("✓ Firebase initialized");
  } catch (e) {
    console.error("✗ Firebase initialization error:", e);
  }
}

// グローバル参照（遅延初期化）
Object.defineProperty(window, 'auth', {
  get: function() {
    return firebase.auth ? firebase.auth() : null;
  }
});

Object.defineProperty(window, 'db', {
  get: function() {
    return firebase.firestore ? firebase.firestore() : null;
  }
});
