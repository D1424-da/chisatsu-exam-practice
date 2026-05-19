# GitHub Pages デプロイガイド

このプロジェクトをGitHub Pagesで公開するための手順です。

## 前提条件
- GitHubアカウント
- Git がインストール済み
- このローカルリポジトリが初期化済み（✅ 完了）

## デプロイ手順

### 1. GitHubでリポジトリを作成

1. [GitHub.com](https://github.com/new) にアクセス
2. リポジトリ名を入力（例：`chisatsu-exam-practice`）
3. 説明を追加（オプション）
4. **「Create repository」をクリック**

### 2. リモートリポジトリをローカルに追加

作成したリポジトリのページで、以下のコマンドをコピーして実行します：

```powershell
cd f:\開発中アプリ\肢別
git remote add origin https://github.com/YOUR_USERNAME/chisatsu-exam-practice.git
git branch -M main
git push -u origin main
```

**YOUR_USERNAME** を実際のGitHubユーザー名に置き換えてください。

### 3. GitHub Pages を有効化

1. GitHub上でリポジトリを開く
2. **Settings**（⚙️ アイコン）をクリック
3. 左メニューから **Pages** を選択
4. **Source** セクションで：
   - **Branch:** `main`
   - **Folder:** `/ (root)`
   - を選択
5. **Save** をクリック

### 4. デプロイ確認

数分後、以下のURLでアプリが公開されます：

```
https://d1424-da.github.io/chisatsu-exam-practice
```

## 以降の更新手順

新しい過去問をスクレイプして更新する場合：

```powershell
# スクレーパーを実行（ローカル）
powershell -ExecutionPolicy Bypass -File .\scraper.ps1 -Year r7 -Start 1 -End 50

# 変更をGitに追加・コミット
git add output/r7_questions.json
git commit -m "Add R7 past exam questions"

# GitHubにプッシュ（自動反映）
git push origin main
```

## トラブルシューティング

### Pages が表示されない場合
- リポジトリが **Public** に設定されているか確認
- **Settings > Pages** で正しいブランチが選択されているか確認
- 5-10分待ってリロード

### JSONファイルが読み込めない場合
- ブラウザコンソール（F12）でエラーを確認
- JSONファイルの相対パスが正しいか確認（`output/` ディレクトリにある）

### CORS エラーが出る場合（ローカル開発時）
- `python -m http.server 8000` でローカルサーバーを実行
- `http://localhost:8000` でアクセス

## セキュリティ注意事項

- `.gitignore` で `scraper.ps1` と `check_urls.ps1` が除外されています ✅
- GitHubへの公開時にスクレーパースクリプトは含まれません ✅
- JSONデータのみ公開されます ✅
