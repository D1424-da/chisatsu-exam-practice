// Firebase Configuration
// => Firebase Console から設定値をコピーペーストしてください
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase を初期化（アプリ起動時に実行される）
try {
  firebase.initializeApp(firebaseConfig);
  console.log("✓ Firebase initialized");
} catch (e) {
  console.error("✗ Firebase initialization error:", e);
}

// グローバル参照
window.auth = firebase.auth();
window.db = firebase.firestore();
