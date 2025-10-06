# MetaLoop — 閉ループ診断（API版 最小プロジェクト）

## 使い方（Netlify）
1. このフォルダをGitHubにpush
2. Netlifyで「Import from Git」→このリポジトリを選択
3. サイトの **Environment variables** に `OPENAI_API_KEY` を設定
4. デプロイ後、サイトURLにアクセス → 入力して「GPTで採点」

## 構成
- index.html … フロント（7入力→関数を呼び出し→結果表示）
- netlify/functions/score.js … サーバーレス関数（Chat Completions JSON出力）
- netlify.toml … Functionsと公開ディレクトリの指定

## 備考
- キーはフロントに埋め込まないでください。必ず環境変数で。
- 将来Responses APIに切替える場合は、score.jsのエンドポイントと出力抽出を調整。