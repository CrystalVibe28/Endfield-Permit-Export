[中文](../README.md) | English

<div align="center">
  <h1>Endfield Permit Export</h1>

  <p>
    A pull history analyzing tool for《Arknights：Endfield》
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

This project is modified from [star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export/), adapted for *Arknights: Endfield* (Gryphline).

An Electron-based desktop tool that runs on Windows 64-bit.

Reads game logs or uses proxy mode to obtain the authKey required to access the gacha history API, then uses the authKey to fetch gacha records.

## Other languages

Modify the JSON files in the `src/i18n/` directory to translate into the appropriate language.

If you find existing translations inaccurate or improvable, feel free to submit a pull request.

## Usage

1. Download and unzip the tool — [GitHub Releases](https://github.com/AiverAiva/Endfield-Permit-Export/releases/latest)
2. Open the gacha details page in the game

   ![warp details](wish-history-en.png)

3. Click the "Load data" button in the tool

   ![load data](load-data-en.png)

   If everything goes well, you'll see a loading prompt and the result will look like this:

   <details>
    <summary>Expand the picture</summary>

   ![preview](preview-en.png)
   </details>

To export data from multiple accounts, click the plus (+) button.

Switch to a new account in the game, open the gacha history, and click "Load data" again.

## Development

```
# Install dependencies
yarn install

# Development mode
yarn dev

# Build a distributable executable
yarn build
```

## License

[MIT](https://github.com/AiverAiva/Endfield-Permit-Export/blob/main/LICENSE)