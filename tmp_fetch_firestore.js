const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// 環境チェック
const pkgPath = 'node_modules/firebase-admin/package.json';
if (!fs.existsSync(pkgPath)) {
  console.error('firebase-admin not found');
  process.exit(1);
}

const app = initializeApp({ projectId: 'chisatsu-exam-practice' });
const db = getFirestore(app);

(async () => {
  const snap = await db.collection('question_sets').doc('shared').get();
  if (!snap.exists) { console.error('doc not found'); process.exit(1); }
  const data = snap.data();
  const qs = data.questions || [];
  console.log('questions:', qs.length);
  console.log('updatedAtMs:', data.updatedAtMs);
})().catch(e => { console.error(e.message); process.exit(1); });
