[English](docs/README_EN.md) | 繁體中文

<div align="center">
  <h1>Endfield Permit Export</h1>

  <p>
    一個《明日方舟：終末地》的抽卡記錄分析工具
  </p>

  <p>
    <a href="https://github.com/AiverAiva/Endfield-Permit-Export/releases">
      <img src="https://img.shields.io/github/v/release/AiverAiva/Endfield-Permit-Export?style=flat-square" />
    </a>
    <img src="https://img.shields.io/github/license/AiverAiva/Endfield-Permit-Export?style=flat-square" />
    <a href="https://github.com/AiverAiva/Endfield-Permit-Export/releases">
      <img src="https://img.shields.io/github/downloads/AiverAiva/Endfield-Permit-Export/total?style=flat-square" />
    </a>
    <img src="https://img.shields.io/github/last-commit/AiverAiva/Endfield-Permit-Export/main?style=flat-square" />
  </p>
</div>

> **注意**：本工具由 [star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export/) 修改而來，功能部份已改為適用於《明日方舟：終末地》。許多文字內容尚未完全與終末地相容，歡迎提交 Pull Request 更新或修正。

一個使用 Electron 製作的小工具，需要在 Windows 64 位元作業系統上執行。

透過讀取遊戲日誌或代理模式取得存取遊戲抽卡記錄 API 所需的 authKey，再使用取得的 authKey 來讀取遊戲抽卡記錄。

## 其他語言

修改 `src/i18n/` 目錄下的 JSON 檔案即可翻譯成對應語言。如果覺得現有翻譯不準確或有可以改進的地方，歡迎隨時修改並發送 Pull Request。

## 使用說明

1. 下載工具後解壓縮 — 下載位置: [GitHub Releases](https://github.com/AiverAiva/Endfield-Permit-Export/releases/latest)
2. 開啟遊戲的抽卡詳情頁面

   ![詳情頁面](docs/wish-history.png)

3. 點擊工具的「載入資料」按鈕

   ![載入資料](docs/load-data.png)

   如果沒出什麼問題，你會看到正在讀取資料的提示，最終效果如下圖所示

   <details>
    <summary>展開圖片</summary>

   ![預覽](docs/preview.png)

   </details>

如需匯出多個帳號的資料，可以點擊旁邊的加號按鈕。

然後在遊戲中切換新帳號，再次開啟抽卡歷史記錄，再點擊工具的「載入資料」按鈕。

## Development

```
# 安裝依賴
yarn install

# 開發模式
yarn dev

# 建置可執行程式
yarn build
```

## License

[MIT](LICENSE)