# 肢別問題集 アプリ

択一問題の選択肢を1肢ずつ○×で判定するWebアプリです。  
**Node.js不要** — `index.html` をブラウザで開くだけで動作します。

---

## 🚀 クイックスタート

### オンライン版（GitHub Pages）
- **推奨**: https://YOUR_USERNAME.github.io/chisatsu-exam-practice
- セットアップ不要、すぐに使用可能
- 詳細は [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) を参照

### ローカル実行
1. `index.html` をブラウザ（Chrome/Edge/Firefox推奨）でダブルクリック
2. または、ローカルサーバー経由：
   ```powershell
   python -m http.server 8000
   # ブラウザで http://localhost:8000 を開く
   ```

---

## 使い方

1. アプリを開く（オンライン版またはローカル版）
2. 初回は「問題管理」→「JSONインポート」で問題データを読み込む
3. 「学習」タブで科目・モードを選んで「学習開始」

---

## 機能

| 機能 | 説明 |
|------|------|
| ○×判定 | 各肢に対して「正しい/誤り」を選択して即時フィードバック |
| 文中〇× | 対話形式の問題で複数の回答を1画面で判定 |
| 解説表示 | 回答後に正解と解説を表示 |
| 正答率記録 | ブラウザのlocalStorageに蓄積（消去まで保持） |
| 苦手優先出題 | 間違えた肢を優先的に出題するモード |
| 科目・カテゴリ絞り込み | 複数試験の問題を混在管理・絞り込み可能 |
| 問題追加・編集 | アプリ内フォームから登録・編集・削除 |
| JSONインポート/エクスポート | データのバックアップと共有 |
| 成績統計 | 科目別正答率・苦手肢トップ10 |

---
## 問題データ形式（JSON）

```json
[
  {
    "id": "一意のID（文字列）",
    "subject": "試験・科目名",
    "category": "カテゴリ（任意）",
    "source": "出典・問題番号（任意）",
    "questionText": "大問文（任意）",
    "limbs": [
      {
        "id": "一意のID",
        "text": "肢の文章",
        "correct": true,
        "explanation": "解説文"
      }
    ]
  }
]
```

---

## 🌐 GitHub Pages でのデプロイ

**GitHub Pages なら、セットアップ不要でURLを共有するだけで使用可能です！**

### デプロイ3ステップ

1. **GitHub でリポジトリ作成**  
   https://github.com/new で新規リポジトリを作成

2. **ローカルからプッシュ**  
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/chisatsu-exam-practice.git
   git branch -M main
   git push -u origin main
   ```

3. **Pages 設定（Settings > Pages > main ブランチを選択）**  
   数分で公開されます: https://YOUR_USERNAME.github.io/chisatsu-exam-practice

詳細: [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md)

---

## 開発

### 過去問スクレーピング（開発者向け）

`scraper.ps1` で試験問題をスクレイピングして JSON に変換できます：

```powershell
# 単一年度：土地家屋調査士H18
powershell -ExecutionPolicy Bypass -File .\scraper.ps1 -Year h18 -Start 1 -End 50

# H17-R7 全年度（コンビニで50問×21年分）
powershell -ExecutionPolicy Bypass -File .\scraper.ps1 -All
```

出力: `output/{h17,h18,...,r7}_questions.json`

---

## ライセンス

MITライセンス

---

## 例題提供元

- 土地家屋調査士試験過去問: https://www.nishio-shinichi-office.com/

powershell -ExecutionPolicy Bypass -File .\scraper.ps1 -Year h18