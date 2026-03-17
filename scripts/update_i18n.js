const fs = require('fs-extra');
const path = require('path');

const CHAR_LIST_URL = 'https://endfieldtools.dev/localdb/optimized/characters/characters-list.json';
const WPN_LIST_URL = 'https://endfieldtools.dev/localdb/optimized/weapons/weapons-list.json';
const I18N_BASE_URL = 'https://endfieldtools.dev/localdb/optimized/i18n/core/I18nTextTable_';

const LANG_MAP = {
  'CN': '简体中文.json',
  'TC': '繁體中文.json',
  'EN': 'English.json',
  'JP': '日本語.json',
  'KR': '한국어.json',
  'DE': 'Deutsch.json',
  'FR': 'Français.json',
  'MX': 'Español.json',
  'PT': 'Português.json',
  'RU': 'Pусский.json',
  'TH': 'ภาษาไทย.json',
  'VI': 'Tiếng Việt.json',
  'ID': 'Indonesia.json'
};

const I18N_DIR = path.join(__dirname, '../src/i18n');

async function start() {
  console.log('Fetching character and weapon lists...');
  const charRes = await fetch(CHAR_LIST_URL);
  const charData = await charRes.json();
  const wpnRes = await fetch(WPN_LIST_URL);
  const wpnData = await wpnRes.json();

  const characters = Object.values(charData);
  const weapons = Object.values(wpnData);

  for (const [code, fileName] of Object.entries(LANG_MAP)) {
    console.log(`\nProcessing language: ${code} (${fileName})...`);
    try {
      const i18nRes = await fetch(`${I18N_BASE_URL}${code}.json`);
      if (!i18nRes.ok) {
        console.warn(`Failed to fetch translations for ${code}: ${i18nRes.statusText}`);
        continue;
      }
      const i18nTable = await i18nRes.json();

      const localFilePath = path.join(I18N_DIR, fileName);
      if (!(await fs.pathExists(localFilePath))) {
        console.warn(`Local file ${fileName} does not exist, skipping.`);
        continue;
      }

      const localI18n = await fs.readJson(localFilePath);

      // Update characters
      for (const char of characters) {
        const translation = i18nTable[char.nameI18nId];
        if (translation) {
          localI18n[`char.${char.charId}`] = translation;
        }
      }

      // Update weapons
      for (const wpn of weapons) {
        const translation = i18nTable[wpn.nameI18nId];
        if (translation) {
          localI18n[`wpn.${wpn.weaponId}`] = translation;
        }
      }

      await fs.writeJson(localFilePath, localI18n, { spaces: 2 });
      console.log(`Updated ${fileName} successfully.`);
    } catch (err) {
      console.error(`Error processing ${code}:`, err.message);
    }
  }

  console.log('\nAll i18n files updated!');
}

start();
