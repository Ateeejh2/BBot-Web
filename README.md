# BBot Web · Mock Dashboard

BBotの管理画面をスマートフォンで確認するための初期版です。Dashboard、Bots、Instances、Jobs、Accounts、Settings、Logsを切り替えられます。**Minecraft Java Edition 1.8.9** を表示します。

現時点ではすべてブラウザ内の一時的なMockデータです。Start / Stop / Recover、Botの8状態への切替、20 Bot生成、Instanceの追加・状態変更、Jobの作成・進行変更、Session Accountの追加を試せます。再読み込みすると初期状態に戻ります。BBot本体への接続やMinecraft操作は発生しません。

## ローカル起動

Node.js 22.12以上、または24系を使います。PowerShellの場合は`npm`を`npm.cmd`に読み替えてください。

```bash
npm ci
npm run dev
```

画面はローカルの`http://127.0.0.1:5173/`で開きます。別端末からのローカルアクセスは初期設定で無効です。画面には実アカウントや実tokenを入力しないでください。

```bash
npm test
npm run build
npm run preview
```

ビルド成果物は`dist/`に生成されます。Cloudflare PagesにはViteの静的ファイルとして配置します。環境変数やサーバー機能は不要です。

## Cloudflare PagesのPreview Deployment

このリポジトリの`feature/mock-mobile-dashboard`ブランチをPreviewとして公開できます。Cloudflareに接続済みの環境で、Cloudflare Pagesの**Direct Upload**を使う例です。Cloudflare側でPreviewを実際に作成したかどうかは[Draft PR](https://github.com/Ateeejh2/BBot-Web/pulls)と別に確認してください。

```bash
npm ci
npm run build
npx wrangler login
npx wrangler pages project create
```

対話設定でPagesプロジェクト名を決め、Production branchには`main`を指定します。その後、**preview branchを明示して**アップロードします。`<PAGES_PROJECT_NAME>`は作成したプロジェクト名に置き換えます。

```bash
npx wrangler pages deploy dist --project-name <PAGES_PROJECT_NAME> --branch=feature/mock-mobile-dashboard
```

Wranglerが出力するPreview URLをスマホで開いてください。branchのalias URLも発行されます。Preview URLは既定で公開されるため、閲覧制限が必要ならCloudflare Accessの設定を確認してください。**この操作は本番の`main`へデプロイしません。**

既存のPages Git連携プロジェクトがある場合は、ビルドコマンドを`npm run build`、出力ディレクトリを`dist`、Production branchを`main`に設定すると、別ブランチのpushでPreviewが生成されます。新たにDirect Upload方式で作成したプロジェクトは後からGit連携方式へ切り替えられません。将来の自動デプロイ方式を選ぶ際はこの制約に注意してください。

参考: [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)、[Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)。

## 設計・安全上の境界

`src/client/types.ts`の`BBotClient`がUIとデータ源の契約です。`src/client/mock.ts`の`MockBBotClient`が現在の実装で、`src/client/index.ts`だけがUIへclientを渡します。将来はREST API + WebSocketを使うRemote実装へ差し替えます。`src/client/remote.ts`はその拡張点を記述し、まだ通信コードは含みません。

Accountsの「Session Account」は画面設計のMockです。実tokenを入力する欄、認証処理、`localStorage`・`sessionStorage`・IndexedDBへのtoken保存はありません。MockのAccountラベルやLogsに秘密情報を入れないでください。UIには最大20 Botと動的Instanceを想定した状態があり、Minecraft側の接続や実動作の保証は含みません。

スマホでは下部ナビゲーション、PCではサイドバーを使います。BotsとJobsは横スクロール表にせずカードで表示し、狭い幅では1列になります。Preview上で再読み込みするとMock操作はリセットされます。
