const fs = require('fs');
const path = require('path');

const STATIC_DIR = path.join(__dirname, '..', 'static');
const CHECKPOINT_FILE = path.join(STATIC_DIR, 'checkpoint.txt');

async function fetchPool(type, id) {
    const url = `https://ef-webview.gryphline.com/api/content?lang=zh-tw&pool_id=${type}_${id}&server_id=2`;
    console.log(`Fetching ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 0 && data.data && data.data.pool) {
        return data;
    }
    return null;
}

function parseId(idStr) {
    const parts = idStr.split('_').map(Number);
    return { x: parts[0], y: parts[1], z: parts[2] };
}

function formatId(x, y, z) {
    return `${x}_${y}_${z}`;
}

async function main() {
    if (!fs.existsSync(STATIC_DIR)) {
        fs.mkdirSync(STATIC_DIR, { recursive: true });
    }

    let checkpointVal = '1_1_2';
    if (fs.existsSync(CHECKPOINT_FILE)) {
        const fileContent = fs.readFileSync(CHECKPOINT_FILE, 'utf-8').trim();
        if (fileContent) {
            checkpointVal = fileContent;
        }
    }

    let { x, y, z } = parseId(checkpointVal);
    
    // Check current checkpoint
    let currentId = formatId(x, y, z);
    let specialData = await fetchPool('special', currentId);
    
    if (specialData) {
        console.log(`Found pool for checkpoint ${currentId}, saving and finishing.`);
    } else {
        console.log(`Pool ${currentId} not found, trying ${formatId(x, y, z + 1)}`);
        currentId = formatId(x, y, z + 1);
        specialData = await fetchPool('special', currentId);
        
        if (specialData) {
            console.log(`Found pool ${currentId}, updating checkpoint.`);
            z = z + 1;
        } else {
            console.log(`Pool ${currentId} not found, trying ${formatId(x, y + 1, 1)}`);
            currentId = formatId(x, y + 1, 1);
            specialData = await fetchPool('special', currentId);
            if (specialData) {
                console.log(`Found pool ${currentId}, updating checkpoint.`);
                y = y + 1; z = 1;
            } else {
                console.log(`Pool ${currentId} not found either. No new pool found.`);
                return; // Stop here if nothing found
            }
        }
    }
    
    // Final checkpoint after resolution
    const newCheckpoint = formatId(x, y, z);
    fs.writeFileSync(CHECKPOINT_FILE, newCheckpoint);
    
    // Fetch weapon data for the found checkpoint. The api uses 'weponbox' as pool_id prefix.
    const weponData = await fetchPool('weponbox', newCheckpoint);
    
    fs.writeFileSync(path.join(STATIC_DIR, `special_${newCheckpoint}.json`), JSON.stringify(specialData, null, 2));
    if (weponData) {
        // The user mentioned weponbox is a typo but we have to use wepon as id
        fs.writeFileSync(path.join(STATIC_DIR, `wepon_${newCheckpoint}.json`), JSON.stringify(weponData, null, 2));
    }
    console.log(`Done processing ${newCheckpoint}.`);
}

main().catch(console.error);
