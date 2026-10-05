# Browser tests (Playwright)

各ファイルはローカル静的サーバーで `editor.html` を開き、Chromium 上で機能を検証します。

```
node tests/test72.mjs   # Android 長押しでブラウザのページメニューが出ない（contextmenu 抑制）
node tests/test66.mjs   # 変換の出力サイズ決定（粗さ N → ドット数）
node tests/test65.mjs   # 変換の長辺上限 1980 / サイズ変更・切り抜きの上限 2048
node tests/test64.mjs   # 動画 → フレーム切り出し → 連番ドット絵変換
```

`createRequire` のパスと Chromium の `executablePath` は実行環境に合わせて変更してください。
