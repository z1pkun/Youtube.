# YouTubeDownloader — Vercel

## 構成

```text
youtube-downloader/
├── api/
│   └── download.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── package.json
├── vercel.json
└── README.md
```

## デプロイ

### Vercel CLI

```bash
npm install -g vercel
vercel
```

本番デプロイ:

```bash
vercel --prod
```

### GitHub

GitHubへpush → VercelでImport → Deploy。

## 注意

この構成はフロントエンドとVercel Serverless Functionを含む完成したデプロイ構成ですが、`api/download.js` の変換エンジンは意図的に未接続です。

Vercel Functionsは長時間の動画変換や巨大な動画ファイルを直接プロキシする用途には適していません。また、第三者サービスの制限を回避する用途には使用しないでください。

MP4/MP3変換を実運用する場合は、権利者の許可があるコンテンツ等を対象にした、利用規約に適合するバックエンド/変換サービスを別途用意し、`api/download.js` から安全に呼び出してください。

最低限、以下をバックエンド側で実装してください。

- URL allowlist
- レート制限
- 入力サイズ/処理時間制限
- ジョブ管理
- 一時ファイルの自動削除
- エラー処理
- CORS/認証
- 利用規約・著作権への対応
