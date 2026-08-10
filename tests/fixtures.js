// 共通フィクスチャ: 外部CDNリクエストをモックして高速化
const { test: base, expect } = require('@playwright/test');

// Firebase SDK の最小モック (compat版)
const FIREBASE_APP_MOCK = `
window.firebase = {
  initializeApp: () => ({}),
  app: () => ({}),
};
`;

const FIREBASE_AUTH_MOCK = `
if (!window.firebase) window.firebase = {};
window.firebase.auth = () => ({
  onAuthStateChanged: (cb) => { cb(null); return () => {}; },
  signInWithEmailAndPassword: () => Promise.reject(new Error('mock')),
  createUserWithEmailAndPassword: () => Promise.reject(new Error('mock')),
  sendPasswordResetEmail: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  currentUser: null,
});
`;

const FIREBASE_FIRESTORE_MOCK = `
if (!window.firebase) window.firebase = {};
window.firebase.firestore = () => ({
  collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => null }), set: () => Promise.resolve(), onSnapshot: (cb) => { cb({ exists: false, data: () => null }); return () => {}; } }) }),
  doc: () => ({ get: () => Promise.resolve({ exists: false }), set: () => Promise.resolve() }),
});
`;

// 外部ドメインを遮断してローカルモックを返すフィクスチャ
const test = base.extend({
  page: async ({ page }, use) => {
    // Firebase SDK リクエストをモックスクリプトで置換
    await page.route('**/firebase-app-compat.js**', async (route) => {
      await route.fulfill({ contentType: 'application/javascript', body: FIREBASE_APP_MOCK });
    });
    await page.route('**/firebase-auth-compat.js**', async (route) => {
      await route.fulfill({ contentType: 'application/javascript', body: FIREBASE_AUTH_MOCK });
    });
    await page.route('**/firebase-firestore-compat.js**', async (route) => {
      await route.fulfill({ contentType: 'application/javascript', body: FIREBASE_FIRESTORE_MOCK });
    });
    // Google Identity Services をモック
    await page.route('**/gsi/client**', async (route) => {
      await route.fulfill({ contentType: 'application/javascript', body: 'window.google = { accounts: { id: { initialize: ()=>{}, renderButton: ()=>{} } } };' });
    });
    // Google Fonts はダミーCSSで応答
    await page.route('**/fonts.googleapis.com/**', async (route) => {
      await route.fulfill({ contentType: 'text/css', body: '' });
    });
    await page.route('**/fonts.gstatic.com/**', async (route) => {
      await route.fulfill({ body: Buffer.from([]) });
    });
    // Firestore REST API をモック
    await page.route('**/firestore.googleapis.com/**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    await page.route('**/firebase.googleapis.com/**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '{}' });
    });

    await use(page);
  },
});

module.exports = { test, expect };
