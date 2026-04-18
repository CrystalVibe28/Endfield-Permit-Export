const fs = require("fs-extra");
const path = require("path");

const CHAR_LIST_URL =
  "https://endfieldtools.dev/localdb/optimized/characters/characters-list.json";
const WPN_LIST_URL =
  "https://endfieldtools.dev/localdb/optimized/weapons/weapons-list.json";

const CHAR_ICON_BASE =
  "https://endfieldtools.dev/assets/images/endfield/charicon/icon_";
const WPN_ICON_BASE =
  "https://endfieldtools.dev/assets/images/endfield/itemicon/";

const CHAR_DEST = path.join(__dirname, "../src/renderer/assets/characters");
const WPN_DEST = path.join(__dirname, "../src/renderer/assets/weapons");

async function downloadFile(url, dest) {
  if (await fs.pathExists(dest)) {
    // console.log(`Skipped: ${path.basename(dest)}`);
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download ${url}: ${response.statusText}`);
      return;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(dest, buffer);
    console.log(`Downloaded: ${path.basename(dest)}`);
  } catch (err) {
    console.error(`Error downloading ${url}:`, err.message);
  }
}

async function start() {
  await fs.ensureDir(CHAR_DEST);
  await fs.ensureDir(WPN_DEST);

  console.log("Fetching character list...");
  try {
    const charRes = await fetch(CHAR_LIST_URL);
    const charData = await charRes.json();
    const charIds = Object.keys(charData);
    console.log(`Found ${charIds.length} characters. Starting download...`);

    for (const id of charIds) {
      if (id === "chr_9000_endmin") continue;
      const url = `${CHAR_ICON_BASE}${id}.png`;
      const dest = path.join(CHAR_DEST, `${id}.png`);
      await downloadFile(url, dest);
    }
  } catch (err) {
    console.error("Error fetching character list:", err.message);
  }

  console.log("\nFetching weapon list...");
  try {
    const wpnRes = await fetch(WPN_LIST_URL);
    const wpnData = await wpnRes.json();
    const wpnIds = Object.keys(wpnData);
    console.log(`Found ${wpnIds.length} weapons. Starting download...`);

    for (const id of wpnIds) {
      const url = `${WPN_ICON_BASE}${id}.png`;
      const dest = path.join(WPN_DEST, `${id}.png`);
      await downloadFile(url, dest);
    }
  } catch (err) {
    console.error("Error fetching weapon list:", err.message);
  }

  console.log("\nDone!");
}

start();
