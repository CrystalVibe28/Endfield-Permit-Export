const fs = require('fs-extra');
const path = require('path');
const { ipcMain, dialog, app } = require('electron');
const { userDataPath, readJSON, saveJSON, sendMsg, getWin } = require('./utils');
const config = require('./config');

function parseOldFormat(data) {
  const characters = [];
  const weapons = [];

  if (!data || !Array.isArray(data.result)) return { characters, weapons };

  for (const [gachaType, records] of data.result) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      const isWeapon = record.item_type === 'Weapon' || (record.item_id && record.item_id.startsWith('wpn_'));

      const ts = new Date(record.time).getTime();
      const base = {
        seqId: String(record.id),
        rarity: parseInt(record.rank_type, 10) || 3,
        gachaTs: String(isNaN(ts) ? 0 : ts),
        poolId: record.gacha_id || gachaType,
        poolName: record.gacha_id || gachaType,
        isFree: false,
        isNew: false,
      };

      if (isWeapon) {
        weapons.push({
          ...base,
          weaponId: record.item_id,
          weaponName: record.name,
        });
      } else {
        characters.push({
          ...base,
          charId: record.item_id,
          charName: record.name,
        });
      }
    }
  }

  return { characters, weapons };
}

function detectGaps(seqIds) {
  if (seqIds.length < 2) return [];
  const sorted = [...seqIds].map(Number).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if (diff > 1) {
      gaps.push({ start: sorted[i - 1] + 1, end: sorted[i] - 1, count: diff - 1 });
    }
  }
  return gaps;
}

function buildPreview(oldChars, oldWeps, newCharList, newWepList) {
  const existingCharIds = new Set(newCharList.map(r => String(r.seqId)));
  const existingWepIds = new Set(newWepList.map(r => String(r.seqId)));

  const overlapChars = [];
  const overlapWeps = [];
  const addChars = [];
  const addWeps = [];

  for (const r of oldChars) {
    if (existingCharIds.has(String(r.seqId))) overlapChars.push(r);
    else addChars.push(r);
  }
  for (const r of oldWeps) {
    if (existingWepIds.has(String(r.seqId))) overlapWeps.push(r);
    else addWeps.push(r);
  }

  const allCharIds = [...newCharList.map(r => Number(r.seqId)), ...addChars.map(r => Number(r.seqId))];
  const allWepIds = [...newWepList.map(r => Number(r.seqId)), ...addWeps.map(r => Number(r.seqId))];

  const charGaps = detectGaps(allCharIds);
  const wepGaps = detectGaps(allWepIds);

  let charOverlapRange = null;
  if (overlapChars.length > 0) {
    const nums = overlapChars.map(r => Number(r.seqId));
    charOverlapRange = { min: String(Math.min(...nums)), max: String(Math.max(...nums)) };
  }
  let wepOverlapRange = null;
  if (overlapWeps.length > 0) {
    const nums = overlapWeps.map(r => Number(r.seqId));
    wepOverlapRange = { min: String(Math.min(...nums)), max: String(Math.max(...nums)) };
  }

  return {
    oldCharCount: oldChars.length,
    oldWepCount: oldWeps.length,
    oldTotal: oldChars.length + oldWeps.length,
    newCharCount: newCharList.length,
    newWepCount: newWepList.length,
    addCharCount: addChars.length,
    addWepCount: addWeps.length,
    addTotal: addChars.length + addWeps.length,
    overlapCharCount: overlapChars.length,
    overlapWepCount: overlapWeps.length,
    overlapTotal: overlapChars.length + overlapWeps.length,
    charOverlapRange,
    wepOverlapRange,
    charGaps,
    wepGaps,
    hasGaps: charGaps.length > 0 || wepGaps.length > 0,
  };
}

function convertOldToNewRecord(record, isWeapon) {
  if (isWeapon) {
    return {
      poolId: record.poolId,
      poolName: record.poolName,
      weaponId: record.weaponId,
      weaponName: record.weaponName,
      rarity: record.rarity,
      isFree: record.isFree,
      isNew: record.isNew,
      gachaTs: record.gachaTs,
      seqId: record.seqId,
    };
  }
  return {
    poolId: record.poolId,
    poolName: record.poolName,
    charId: record.charId,
    charName: record.charName,
    rarity: record.rarity,
    isFree: record.isFree,
    isNew: record.isNew,
    gachaTs: record.gachaTs,
    seqId: record.seqId,
  };
}

async function getTargetFileList() {
  await fs.ensureDir(userDataPath);
  const files = await fs.readdir(userDataPath);
  const result = [];
  for (const name of files) {
    if (/^endfield-list-.+\.json$/.test(name)) {
      try {
        const data = await readJSON(userDataPath, name);
        if (data && data.info && data.info.uid) {
          result.push({
            uid: data.info.uid,
            fileName: name,
            charCount: (data.characterList || []).length,
            wepCount: (data.weaponList || []).length,
          });
        }
      } catch {}
    }
  }
  return result;
}

async function getOldFileInfo(filePath) {
  try {
    const data = await fs.readJSON(filePath);
    if (!data || !data.result) return null;
    const { characters, weapons } = parseOldFormat(data);
    return {
      uid: data.uid || 'unknown',
      lang: data.lang || '',
      recordCount: characters.length + weapons.length,
      charCount: characters.length,
      wepCount: weapons.length,
      time: data.time || 0,
    };
  } catch {
    return null;
  }
}

ipcMain.handle('OPEN_MERGE_FILE_DIALOG', async () => {
  const win = getWin();
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: '選擇舊版存檔',
    defaultPath: userDataPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const info = await getOldFileInfo(filePath);
  if (!info) return null;
  return { filePath, ...info };
});

ipcMain.handle('GET_MERGE_TARGET_LIST', async () => {
  return await getTargetFileList();
});

ipcMain.handle('GET_MERGE_PREVIEW', async (event, { oldFilePath, targetUid }) => {
  try {
    const oldData = await fs.readJSON(oldFilePath);
    if (!oldData || !oldData.result) return { error: 'INVALID_OLD_FORMAT' };

    const { characters: oldChars, weapons: oldWeps } = parseOldFormat(oldData);

    const newFileName = `endfield-list-${targetUid}.json`;
    const newData = await readJSON(userDataPath, newFileName);
    if (!newData) return { error: 'TARGET_NOT_FOUND' };

    const newCharList = newData.characterList || [];
    const newWepList = newData.weaponList || [];

    return buildPreview(oldChars, oldWeps, newCharList, newWepList);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('EXECUTE_MERGE', async (event, { oldFilePath, targetUid }) => {
  try {
    const timestamp = Date.now();
    const backupDir = path.join(userDataPath, 'backup', String(timestamp));
    await fs.ensureDir(backupDir);

    const oldData = await fs.readJSON(oldFilePath);
    if (!oldData || !oldData.result) return { error: 'INVALID_OLD_FORMAT' };

    const newFileName = `endfield-list-${targetUid}.json`;
    const newData = await readJSON(userDataPath, newFileName);
    if (!newData) return { error: 'TARGET_NOT_FOUND' };

    // Backup
    const oldBaseName = path.basename(oldFilePath);
    await fs.copy(oldFilePath, path.join(backupDir, oldBaseName));
    await fs.copy(path.join(userDataPath, newFileName), path.join(backupDir, newFileName));

    // Parse old
    const { characters: oldChars, weapons: oldWeps } = parseOldFormat(oldData);
    const existingCharIds = new Set((newData.characterList || []).map(r => String(r.seqId)));
    const existingWepIds = new Set((newData.weaponList || []).map(r => String(r.seqId)));

    let charAdded = 0;
    let wepAdded = 0;
    let charSkipped = 0;
    let wepSkipped = 0;

    for (const r of oldChars) {
      if (existingCharIds.has(String(r.seqId))) {
        charSkipped++;
      } else {
        newData.characterList.push(convertOldToNewRecord(r, false));
        charAdded++;
      }
    }
    for (const r of oldWeps) {
      if (existingWepIds.has(String(r.seqId))) {
        wepSkipped++;
      } else {
        if (!newData.weaponList) newData.weaponList = [];
        newData.weaponList.push(convertOldToNewRecord(r, true));
        wepAdded++;
      }
    }

    // Sort newest first
    newData.characterList.sort((a, b) => Number(b.seqId) - Number(a.seqId));
    if (newData.weaponList) {
      newData.weaponList.sort((a, b) => Number(b.seqId) - Number(a.seqId));
    }

    // Update info
    newData.info.export_timestamp = Math.floor(Date.now() / 1000);
    newData.info.app_version = app.getVersion();

    // Save
    await saveJSON(newFileName, newData);

    // Delete old file
    try {
      await fs.remove(oldFilePath);
    } catch {}

    // Build preview for log
    const allCharIds = newData.characterList.map(r => Number(r.seqId));
    const allWepIds = (newData.weaponList || []).map(r => Number(r.seqId));
    const charGaps = detectGaps(allCharIds);
    const wepGaps = detectGaps(allWepIds);

    // Overlap range (separate for char and weapon since seqId is independent)
    const overlapCharList = oldChars.filter(r => existingCharIds.has(String(r.seqId)));
    const overlapWepList = oldWeps.filter(r => existingWepIds.has(String(r.seqId)));
    let charOverlapRange = null;
    if (overlapCharList.length > 0) {
      const nums = overlapCharList.map(r => Number(r.seqId));
      charOverlapRange = { min: String(Math.min(...nums)), max: String(Math.max(...nums)) };
    }
    let wepOverlapRange = null;
    if (overlapWepList.length > 0) {
      const nums = overlapWepList.map(r => Number(r.seqId));
      wepOverlapRange = { min: String(Math.min(...nums)), max: String(Math.max(...nums)) };
    }

    // Write merge log
    const logContent = {
      timestamp,
      date: new Date(timestamp).toISOString(),
      oldFile: oldBaseName,
      targetFile: newFileName,
      oldUid: oldData.uid || 'unknown',
      targetUid,
      totalOldRecords: oldChars.length + oldWeps.length,
      charAdded,
      wepAdded,
      charSkipped,
      wepSkipped,
      charOverlapRange,
      wepOverlapRange,
      charGaps,
      wepGaps,
      finalCharCount: newData.characterList.length,
      finalWepCount: (newData.weaponList || []).length,
    };
    await fs.outputJSON(path.join(backupDir, 'merge-log.json'), logContent, { spaces: 2 });

    return {
      success: true,
      backupDir,
      ...logContent,
    };
  } catch (e) {
    return { error: e.message };
  }
});
