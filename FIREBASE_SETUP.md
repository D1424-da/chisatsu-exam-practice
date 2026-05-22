# Firebase 統合ガイド

このアプリは Firebase を使用した認証と Firestore データベースに対応しています。

## 📋 Firebase プロジェクト作成手順

### 1. Firebase Console でプロジェクトを作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. **「プロジェクトを作成」**をクリック
3. プロジェクト名：`chisatsu-exam-practice` と入力
4. Google Analytics を有効にして**「プロジェクトを作成」**

### 2. Firebase プロジェクト設定を取得

1. 左上の⚙️ **「プロジェクト設定」**をクリック
2. **「アプリ」**タブ → **「ウェブ」**を選択
3. 表示されるコード内の `firebaseConfig` をコピー

例：
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDp...",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "123456...",
  appId: "1:123456..."
};
```

### 3. firebase-config.js に設定値を貼り付け

[firebase-config.js](./firebase-config.js) の `firebaseConfig` を上記の値で置き換えます：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDp...",  // ← ここに貼り付け
  // ...
};
```

## ⚙️ Firebase で認証を設定

### Authentication を有効化

1. **Build → Authentication** をクリック
2. **「Sign-in method」**タブ
3. **「メール/パスワード」**
   - **有効にする** をON
   - **メールリンク（パスワードレス）**はOFF のまま
   - **保存**をクリック

4. **Google** を有効化（オプション）
   - **「Google」**をクリック
   - **有効にする** をON
   - サポートメールアドレスを選択
   - プロジェクトの公開名を入力
   - **保存**

### Google Sign-In の設定（オプション）

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 左上で Firebase プロジェクトを選択
3. **「認証情報」 → 「認証情報を作成」 → 「OAuth クライアント ID」**
4. **アプリケーションの種類：「ウェブ アプリケーション」**
5. **「作成」**をクリック
6. 表示される **Client ID** をコピー

[firebase-config.js](./firebase-config.js) の `window.APP_CONFIG.googleClientId` に貼り付けます：

```javascript
window.APP_CONFIG = {
  googleClientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
};
```

## 🗄️ Firestore Database を設定

1. **Build → Firestore Database** をクリック
2. **「データベースを作成」**
3. **セキュリティルール：「テストモード」** を選択
   ⚠️ **注意**：本番環境ではセキュリティルールを必ず修正してください
4. **リージョン：asia-northeast1（東京）** を選択
5. **「作成」**

### 推奨セキュリティルール（本番運用可）

以下をアクセス許可 のセクションに設定：

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /question_sets/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /study_stats/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /records/{recordId} {
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow read: if (request.auth != null && recordId == request.auth.uid)
        || (request.auth != null && resource.data.uid == request.auth.uid);
      allow update, delete: if (request.auth != null && recordId == request.auth.uid)
        || (request.auth != null && resource.data.uid == request.auth.uid);
    }
  }
}
```

このリポジトリには同内容の [firestore.rules](./firestore.rules) を追加済みです。Firebase CLI で反映する場合：

```powershell
firebase deploy --only firestore:rules
# もし firebase コマンドが見つからない場合
npx firebase-tools deploy --only firestore:rules --project chisatsu-exam-practice
```

## 📊 ユーザーデータの同期

### Firestore に保存されるデータ構造

**users コレクション**
```
uid/
  ├── email: string
  ├── displayName: string
  ├── createdAt: timestamp
  └── photoURL: string (Google ログイン時)
```

**question_sets コレクション**
```
uid/
  ├── uid: string
  ├── questions: array
  ├── updatedAtMs: number
  └── updatedAt: timestamp
```

**study_stats コレクション**
```
uid/
  ├── uid: string
  ├── totalMs: number
  ├── updatedAtMs: number
  └── updatedAt: timestamp
```

**records コレクション**
```
{recordId}/
  ├── uid: string
  ├── records: map<string,{correct:number,wrong:number}>
  ├── updatedAtMs: number
  ├── accessedAtMs: number
  └── updatedAt: timestamp
```

## 🔒 本番環境でのセキュリティ設定

テスト環境から本番環境に移行する前に、以下を設定します：

### 1. Authentication
- メール認証の確認メールを有効化
- パスワードポリシーを設定
- 不正なログイン試行を検出

### 2. Firestore セキュリティルール
- [firestore.rules](./firestore.rules) をそのまま利用してください。

## 🧪 テスト方法

1. ローカルで `python -m http.server 8000` でサーバーを起動
2. `http://localhost:8000` をブラウザで開く
3. **「新規ユーザー作成」**でメールアドレスとパスワードを登録
4. ログイン画面でログイン
5. アプリが表示されたら成功！

## 🐛 トラブルシューティング

### Firebase 初期化エラー
- `firebase-config.js` の `firebaseConfig` の値が正しいか確認
- Console（F12）でエラーメッセージを確認

### ログイン失敗
- Firebase Console → Authentication → Sign-in method で「メール/パスワード」が有効化されているか確認
- メールアドレス形式が正しいか、パスワードが6文字以上か確認

### Google ログイン が表示されない
- `firebase-config.js` の `window.APP_CONFIG.googleClientId` を設定したか確認
- Google Identity Services ライブラリが読み込まれているか（F12 → Network）確認

### Firestore にデータが保存されない
- Firestore ルールに `question_sets` と `study_stats` が含まれているか確認
- Authentication でログインしているか確認
- セキュリティルールが正しいか確認

## 📝 GitHub Pages での動作確認

Firebase/Firestore は GitHub Pages でも動作しますが：

1. `firebase-config.js` に正しい設定値が入っているか確認
2. GitHub Pages のドメインを Google Cloud Console の認可されたリダイレクト URIに追加：
   - `https://YOUR_USERNAME.github.io`

## サポート

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
