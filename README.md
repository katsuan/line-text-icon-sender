# TextIconSender

Google Drive と Google Apps Script を使って、生成した 180x180 PNG を保存し、その URL を `LIFF ShareTargetPicker` に渡す構成です。

## ファイル

- `index.html`: 送信UI
- `app.js`: 生成、Drive 保存、LIFF 共有
- `config.js`: LIFF と GAS の設定値
- `gas/Code.gs`: Apps Script 本体
- `gas/appsscript.json`: Apps Script マニフェスト

## フロント側の設定

`config.js` を編集して値を入れます。

```js
window.TEXT_ICON_SENDER_CONFIG = {
  liffId: "YOUR_LIFF_ID",
  gasWebAppUrl: "YOUR_GAS_WEB_APP_URL",
  gasPreviewBaseUrl: "",
  defaultFolderLabel: "TextIconSender",
  testUserKey: "local_debug",
};
```

## GAS 側の設定

`texticon/sender/gas` は `clasp` 管理を前提にしています。

1. Apps Script で新規プロジェクトを作る
2. プロジェクト設定から `Script ID` を控える
3. `texticon/sender/gas/.clasp.json.example` を `.clasp.json` にコピーして `scriptId` を入れる
4. Apps Script の `スクリプト プロパティ` に `DRIVE_FOLDER_ID` を追加し、保存先フォルダ ID を入れる
5. `texticon/sender/gas` で `npm install` を実行する
6. `npx clasp login` でログインする
7. `npx clasp push` で Apps Script に反映する
8. Apps Script 側でウェブアプリとしてデプロイする
9. 実行ユーザーは自分、アクセス権は `全員` にする
10. 発行された Web App URL を `config.js` の `gasWebAppUrl` に入れる

`package.json` には以下のショートカットを入れています。

- `npm run push`: GAS へ反映
- `npm run pull`: GAS から取得
- `npm run open`: Apps Script エディタを開く
- `npm run deploy:webapp`: Web アプリ用デプロイ
- `npm run version`: バージョン作成

## 注意

- LIFF は `https://` で配信された URL で開く必要があります
- `file://` では LIFF 初期化ができません
- `file://` や LIFF 未初期化時は `config.js` の `testUserKey` を使って Drive 側のユーザーフォルダを作ります
- Drive には `ユーザー別フォルダ / 画像条件のハッシュ名.png` で保存され、同じ条件なら既存画像を再利用します
- Google Drive の公開 URL は小さい PNG なら扱いやすいですが、長期的には専用ストレージの方が安定です
