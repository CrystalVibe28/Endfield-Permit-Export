const fs = require('fs-extra')
const path = require('path')
const { app, ipcMain, shell } = require('electron')
const { sendMsg, readJSON, saveJSON, detectLocale, userDataPath, localIp, langMap, sleep } = require('./utils')
const config = require('./config')
const i18n = require('./i18n')
const { mergeData } = require('./utils/mergeData')
// const gachaTypeRaw = require('../gachaType.json') // Removed or unused
const fetch = require('electron-fetch').default

const dataMap = new Map()
let apiDomain = 'https://ef-webview.gryphline.com'

const saveData = async (data) => {
    const obj = Object.assign({}, data)
    obj.result = [...obj.result]
    if (obj.typeMap) obj.typeMap = [...obj.typeMap]
    await config.save()
    await saveJSON(`gacha-list-${data.uid}.json`, obj)
}

const extractEfWebview = async () => {
    const homeDir = app.getPath('home')
    let logPaths = [
        path.join(homeDir, "AppData", "LocalLow", "Gryphline", "Endfield", "sdklogs", "HGWebview.log"),
        path.join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")
    ]

    if (config.logType === 3) {
        if (!config.manualUrl) {
            sendMsg('Manual URL not provided.')
            return false
        }
        try {
            const parsed = new URL(config.manualUrl)
            const token = parsed.searchParams.get("u8_token") || parsed.searchParams.get("token")
            const lang = parsed.searchParams.get("lang")
            const serverRaw = parsed.searchParams.get("server") || parsed.searchParams.get("server_id")

            if (token && lang && serverRaw) {
                return [{
                    token,
                    lang,
                    serverId: serverRaw,
                    host: parsed.host,
                    apiDomain: `${parsed.protocol}//${parsed.host}`
                }]
            } else {
                 sendMsg('Invalid Manual URL format.')
                 return false
            }
        } catch (e) {
            sendMsg('Error parsing Manual URL.')
            return false
        }
    }

    if (config.logType === 1) {
        logPaths = [path.join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")]
    } else if (config.logType === 2) {
        logPaths = [path.join(homeDir, "AppData", "LocalLow", "Gryphline", "Endfield", "sdklogs", "HGWebview.log")]
    }

    const allInfos = []

    for (const logPath of logPaths) {
        try {
            if (await fs.pathExists(logPath)) {
                const content = await fs.readFile(logPath, "utf-8")
                const regex = /https:\/\/ef-webview\.(gryphline|hypergryph)\.com[^\s"'<>]*[&\?](u8_token|token)=[^&\s"'<>]+[^\s"'<>]*/g
                const matches = content.match(regex)

                if (matches && matches.length > 0) {
                    const latestUrl = matches[matches.length - 1]
                    const parsed = new URL(latestUrl)
                    const token = parsed.searchParams.get("u8_token") || parsed.searchParams.get("token")
                    const lang = parsed.searchParams.get("lang")
                    const serverRaw = parsed.searchParams.get("server") || parsed.searchParams.get("server_id")

                    if (token && lang && serverRaw) {
                        allInfos.push({
                            token,
                            lang,
                            serverId: serverRaw,
                            host: parsed.host,
                            apiDomain: `${parsed.protocol}//${parsed.host}`
                        })
                    }
                }
            }
        } catch (e) { }
    }

    if (allInfos.length === 0) {
        sendMsg('No valid log files or URLs found.')
        return false
    }

    return allInfos
}

const POOL_TYPES = [
    'E_CharacterGachaPoolType_Standard',
    'E_CharacterGachaPoolType_Special',
    'E_CharacterGachaPoolType_Beginner',
]

const poolIdMap = {
    'E_CharacterGachaPoolType_Standard': 'standard',
    'E_CharacterGachaPoolType_Special': 'special',
    'E_CharacterGachaPoolType_Beginner': 'beginner'
}

const adaptUserLog = (userLog, poolType) => {
    // timestamp "1769062855302" -> "YYYY-MM-DD HH:mm:ss"
    const date = new Date(parseInt(userLog.gachaTs));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const gacha_type = userLog.isFree ? 'urgent' : (poolIdMap[poolType] || 'standard')
    return {
        id: userLog.seqId,
        item_id: userLog.charId,
        item_type: "Character", // Assuming all are characters for now based on API endpoint
        name: userLog.charName,
        rank_type: userLog.rarity.toString(),
        time: timeStr,
        gacha_id: userLog.poolId,
        gacha_type,
        count: "1"
    }
}
// ... (skip lines)

const processGryphlineList = ({ characterList = [], weaponList = [] }) => {
    const result = new Map()
    // Initialize lists
    const pools = {
        'standard': [],   
        'special': [],  
        'weapon': [],  
        'beginner': [],  
        'urgent': []  
    }

    // Process Characters
    const sortedChars = [...characterList].sort((a, b) => Number(a.seqId) - Number(b.seqId))
    for (const item of sortedChars) {
        // Adapt fields
        const date = new Date(parseInt(item.gachaTs))
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

        const adapted = {
            id: item.seqId,
            item_id: item.charId,
            item_type: "Character",
            name: item.charName,
            rank_type: item.rarity ? item.rarity.toString() : "3",
            time: timeStr,
            gacha_id: item.poolId,
            poolId: item.poolId,
            poolName: item.poolName,
            count: "1"
        }

        // Categorize Characters
        if (item.isFree) {
            adapted.gacha_type = 'urgent'
            pools['urgent'].push(adapted)
        } else {
            const pid = item.poolId || ''
            if (pid === 'standard') {
                adapted.gacha_type = 'standard'
                pools['standard'].push(adapted)
            } else if (pid === 'beginner') {
                adapted.gacha_type = 'beginner'
                pools['beginner'].push(adapted)
            } else if (pid.startsWith('special_')) {
                adapted.gacha_type = 'special'
                pools['special'].push(adapted)
            } else {
                // Fallback for unknown character pools
                adapted.gacha_type = 'standard'
                pools['standard'].push(adapted)
            }
        }
    }

    // Process Weapons
    const sortedWeapons = [...weaponList].sort((a, b) => Number(a.seqId) - Number(b.seqId))
    for (const item of sortedWeapons) {
        // Adapt fields
        const date = new Date(parseInt(item.gachaTs))
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

        const adapted = {
            id: item.seqId,
            item_id: item.weaponId,
            item_type: "Weapon",
            name: item.weaponName,
            rank_type: item.rarity ? item.rarity.toString() : "3",
            time: timeStr,
            gacha_id: item.poolId,
            poolId: item.poolId,
            poolName: item.poolName,
            count: "1",
            gacha_type: 'weapon'
        }

        pools['weapon'].push(adapted)
    }

    for (const [key, list] of Object.entries(pools)) {
        if (list.length > 0) result.set(key, list)
    }
    return result
}

const saveGryphlineData = async (uid, { characterList = [], weaponList = [], lang }) => {
    const fileName = `endfield-list-${uid}.json`
    let existingData = { 
        info: { 
            uid, 
            export_timestamp: Math.floor(Date.now()/1000), 
            app_version: app.getVersion(),
            lang: lang || config.lang
        }, 
        characterList: [],
        weaponList: []
    }
    
    try {
        const loaded = await readJSON(userDataPath, fileName)
        if (loaded) {
            if (loaded.list) {
                // Migration: Split old mixed list
                const oldList = loaded.list
                existingData.characterList = oldList.filter(item => item.charId)
                existingData.weaponList = oldList.filter(item => item.weaponId)
                // Use loaded info if available
                if (loaded.info) {
                    existingData.info = loaded.info
                    if (lang) existingData.info.lang = lang
                }
            } else {
                if (loaded.characterList) existingData.characterList = loaded.characterList
                if (loaded.weaponList) existingData.weaponList = loaded.weaponList
                if (loaded.info) {
                    existingData.info = loaded.info
                    if (lang) existingData.info.lang = lang
                }
            }
        }
    } catch {}

    // Merge Character List
    if (characterList && characterList.length > 0) {
        const existingIds = new Set(existingData.characterList.map(i => String(i.seqId)))
        const toAdd = characterList.filter(i => !existingIds.has(String(i.seqId)))
        if (toAdd.length > 0) {
            existingData.characterList.push(...toAdd)
        }
    }
    // Sort Characters (Newest first)
    existingData.characterList.sort((a, b) => Number(b.seqId) - Number(a.seqId))

    // Merge Weapon List
    if (weaponList && weaponList.length > 0) {
        const existingIds = new Set(existingData.weaponList.map(i => String(i.seqId)))
        const toAdd = weaponList.filter(i => !existingIds.has(String(i.seqId)))
        if (toAdd.length > 0) {
            existingData.weaponList.push(...toAdd)
        }
    }
    // Sort Weapons (Newest first)
    existingData.weaponList.sort((a, b) => Number(b.seqId) - Number(a.seqId))
    
    existingData.info.export_timestamp = Math.floor(Date.now()/1000)
    existingData.info.app_version = app.getVersion()
    
    await saveJSON(fileName, existingData)
}

const fetchCharRecord = async ({ token, lang, serverId, poolType, seqId }) => {
    const url = new URL(`${apiDomain}/api/record/char`)
    url.searchParams.append('token', token)
    url.searchParams.append('lang', lang)
    url.searchParams.append('server_id', serverId)
    url.searchParams.append('pool_type', poolType)
    if (seqId) url.searchParams.append('seq_id', seqId)

    // DEBUG LOG
    console.log(`[fetchCharRecord] Fetching: ${url.toString()}`)

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return await response.json()
}

const fetchWeaponPools = async ({ lang, token, serverId }) => {
    const url = new URL(`${apiDomain}/api/record/weapon/pool`)
    url.searchParams.append('lang', lang)
    url.searchParams.append('token', token)
    url.searchParams.append('server_id', serverId)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return await response.json()
}

const fetchWeaponRecord = async ({ token, lang, serverId, poolId, seqId }) => {
    const url = new URL(`${apiDomain}/api/record/weapon`)
    url.searchParams.append('token', token)
    url.searchParams.append('lang', lang)
    url.searchParams.append('server_id', serverId)
    url.searchParams.append('pool_id', poolId)
    if (seqId) url.searchParams.append('seq_id', seqId)

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return await response.json()
}

const getAllRecord = async ({ token, lang, serverId, existingSeqIds = new Set() }) => {
    const typeMap = new Map()
    // Populate typeMap for logging purposes
    typeMap.set('standard', i18n.parse(i18n.gacha.type.standard))
    typeMap.set('special', i18n.parse(i18n.gacha.type.special))
    typeMap.set('beginner', i18n.parse(i18n.gacha.type.beginner))
    typeMap.set('urgent', i18n.parse(i18n.gacha.type.urgent))
    
    const characterList = []
    const weaponList = []

    sendMsg(i18n.parse(i18n.log.fetch.gachaType))
    await sleep(1) 
    sendMsg(i18n.parse(i18n.log.fetch.gachaTypeOk))

    // 1. Character Pools
    for (const poolType of POOL_TYPES) {
        let hasMore = true
        let lastSeqId = undefined
        const mappedKey = poolIdMap[poolType]
        const name = typeMap.get(mappedKey)
        let page = 1

        while (hasMore) {
            if (page % 10 === 0 && page > 0) {
                sendMsg(i18n.parse(i18n.log.fetch.interval, { name, page }))
                await sleep(1)
            } else {
                sendMsg(i18n.parse(i18n.log.fetch.current, { name, page }))
            }

            // Retry logic
            let retryCount = 0
            let success = false
            let res = null

            while (retryCount < 5) {
                try {
                    res = await fetchCharRecord({ token, lang, serverId, poolType, seqId: lastSeqId })

                    if (!res || !res.data) {
                        const message = res ? res.message : 'Unknown error'
                        if (message === 'auth key timeout' || (res && res.code === -101)) {
                            throw new Error('AUTH_TIMEOUT')
                        }
                        throw new Error(`API Error: ${message}`)
                    }

                    success = true
                    break
                } catch (e) {
                    if (e.message === 'AUTH_TIMEOUT' || (res && res.code === -101)) {
                        sendMsg(i18n.log.fetch.authTimeout)
                        throw e
                    }

                    retryCount++
                    if (retryCount >= 5) {
                        sendMsg(i18n.parse(i18n.log.fetch.retryFailed, { name, page }))
                        hasMore = false 
                        break
                    }

                    sendMsg(i18n.parse(i18n.log.fetch.retry, { name, page, count: retryCount }))
                    await sleep(5)
                }
            }

            if (!success) break

            const list = res.data.list
            
            if (!(page % 10 === 0)) {
                await sleep(0.5)
            }

            if (list && list.length > 0) {
                let foundExisting = false
                for (const item of list) {
                    if (existingSeqIds.has(String(item.seqId))) {
                        foundExisting = true
                        break
                    }
                    characterList.push(item)
                }

                if (foundExisting) {
                    sendMsg(i18n.parse(i18n.log.fetch.skip, { name }))
                    hasMore = false
                    break
                }
                
                lastSeqId = list[list.length - 1].seqId
            }
            hasMore = res.data.hasMore
            page++
        }
    }

    // 2. Weapon Pools
    let weaponPoolsData = []
    try {
        const wpRes = await fetchWeaponPools({ lang, token, serverId })
        if (wpRes && wpRes.data) {
            weaponPoolsData = wpRes.data
        }
    } catch (e) {
        console.error("Failed to fetch weapon pools", e)
    }

    for (const pool of weaponPoolsData) {
        const poolType = pool.poolId
        const poolName = pool.poolName
        // Use poolName for logging
        
        let hasMore = true
        let lastSeqId = undefined
        const name = poolName
        let page = 1

        while (hasMore) {
            if (page % 10 === 0 && page > 0) {
                sendMsg(i18n.parse(i18n.log.fetch.interval, { name, page }))
                await sleep(1)
            } else {
                sendMsg(i18n.parse(i18n.log.fetch.current, { name, page }))
            }

            // Retry logic
            let retryCount = 0
            let success = false
            let res = null

            while (retryCount < 5) {
                try {
                    res = await fetchWeaponRecord({ token, lang, serverId, poolId: poolType, seqId: lastSeqId })

                    if (!res || !res.data) {
                        const message = res ? res.message : 'Unknown error'
                        if (message === 'auth key timeout' || (res && res.code === -101)) {
                            throw new Error('AUTH_TIMEOUT')
                        }
                        throw new Error(`API Error: ${message}`)
                    }

                    success = true
                    break
                } catch (e) {
                    if (e.message === 'AUTH_TIMEOUT' || (res && res.code === -101)) {
                        sendMsg(i18n.log.fetch.authTimeout)
                        throw e
                    }

                    retryCount++
                    if (retryCount >= 5) {
                        sendMsg(i18n.parse(i18n.log.fetch.retryFailed, { name, page }))
                        hasMore = false
                        break
                    }

                    sendMsg(i18n.parse(i18n.log.fetch.retry, { name, page, count: retryCount }))
                    await sleep(5)
                }
            }

            if (!success) break

            const list = res.data.list

            if (!(page % 10 === 0)) {
                await sleep(0.5)
            }

            if (list && list.length > 0) {
                let foundExisting = false
                for (const item of list) {
                    if (existingSeqIds.has(String(item.seqId))) {
                        foundExisting = true
                        break
                    }
                    weaponList.push(item)
                }

                if (foundExisting) {
                    sendMsg(i18n.parse(i18n.log.fetch.skip, { name }))
                    hasMore = false
                    break
                }

                lastSeqId = list[list.length - 1].seqId
            }
            hasMore = res.data.hasMore
            page++
        }
    }

    return { characterList, weaponList }
}


const fetchData = async () => {
    await readData() // Load existing local data

    const allInfos = await extractEfWebview()
    if (!allInfos) return

    for (const info of allInfos) {
        const { token, lang, serverId, host, apiDomain: currentApiDomain } = info

        // Update global apiDomain for this fetch iteration
        apiDomain = currentApiDomain

        // Keep standard Global UID format as EF_serverId, only prefix CN server
        let uid = `EF_${serverId}`
        if (host.includes('hypergryph')) {
            uid = `EF_CN_${serverId}`
        }

        sendMsg(`Processing account: ${uid}`)

        // Incremental update optimization: prepare existing seqIds
        const existingSeqIds = new Set()
        let fileName = `endfield-list-${uid}.json`
        try {
            const loaded = await readJSON(userDataPath, fileName)
            if (loaded) {
                const charList = loaded.characterList || []
                const wepList = loaded.weaponList || []
                charList.forEach(i => existingSeqIds.add(String(i.seqId)))
                wepList.forEach(i => existingSeqIds.add(String(i.seqId)))
                
                // Also support legacy 'list' key if migrating
                if (loaded.list) {
                    loaded.list.forEach(i => existingSeqIds.add(String(i.seqId)))
                }
            }
        } catch {}

        const { characterList, weaponList } = await getAllRecord({ token, lang, serverId, existingSeqIds })
        const data = { uid, rawList: [] } // Legacy structure not used but defined
        
        // Save raw Gryphline data
        await saveGryphlineData(uid, { characterList, weaponList, lang })
        
        // Read back updated data
        fileName = `endfield-list-${uid}.json`
        try {
            const loaded = await readJSON(userDataPath, fileName)
            if (loaded) { // loaded can be object with characterList/weaponList
                let charList = loaded.characterList || []
                let wepList = loaded.weaponList || []
                
                // Fallback for immediate processing if load fails to find new keys immediately (unlikely)
                if (loaded.list) {
                    charList = loaded.list.filter(i => i.charId)
                    wepList = loaded.list.filter(i => i.weaponId)
                }

                const processedResult = processGryphlineList({ characterList: charList, weaponList: wepList })
                
                const uiData = {
                    uid: uid,
                    time: loaded.info.export_timestamp * 1000,
                    result: processedResult,
                    typeMap: new Map(),
                    // rawList: ... // not strictly needed for UI if result is populated
                }
                
                uiData.typeMap.set('standard', i18n.parse(i18n.gacha.type.standard))
                uiData.typeMap.set('special', i18n.parse(i18n.gacha.type.special))
                uiData.typeMap.set('weapon', i18n.parse(i18n.gacha.type.weapon))
                uiData.typeMap.set('beginner', i18n.parse(i18n.gacha.type.beginner))
                uiData.typeMap.set('urgent', i18n.parse(i18n.gacha.type.urgent))

                dataMap.set(uid, uiData)
                await changeCurrent(uid)
            }
        } catch (e) {
            console.error("Failed to process saved gryphline data", e)
        }
    }
}

const readData = async () => {
    await fs.ensureDir(userDataPath)
    dataMap.clear()
    const files = await fs.readdir(userDataPath)
    for (let name of files) {
        if (/^(gryphline|endfield)-list-.+\.json$/.test(name)) {
            try {
                const data = await readJSON(userDataPath, name)
                if (data.info && data.info.uid) {
                    const uid = data.info.uid
                    let charList = data.characterList || []
                    let wepList = data.weaponList || []
                    
                    // Migration on read if needed (though save handles it on next fetch)
                    if (data.list && (!charList.length && !wepList.length)) {
                        charList = data.list.filter(i => i.charId)
                        wepList = data.list.filter(i => i.weaponId)
                    }

                    const processedResult = processGryphlineList({ characterList: charList, weaponList: wepList })
                    
                    const uiData = {
                        uid: uid,
                        lang: data.info.lang || config.lang,
                        time: data.info.export_timestamp * 1000,
                        result: processedResult,
                        typeMap: new Map(),
                        // rawList: data.list // Legacy
                    }
                    
                    uiData.typeMap.set('standard', i18n.parse(i18n.gacha.type.standard))
                    uiData.typeMap.set('special', i18n.parse(i18n.gacha.type.special))
                    uiData.typeMap.set('weapon', i18n.parse(i18n.gacha.type.weapon))
                    uiData.typeMap.set('beginner', i18n.parse(i18n.gacha.type.beginner))
                    uiData.typeMap.set('urgent', i18n.parse(i18n.gacha.type.urgent))

                    dataMap.set(uid, uiData)
                }
            } catch (e) { 
                console.error("Error reading gryphline list", e)
            }
        }
    }
}

const changeCurrent = async (uid) => {
    config.current = uid
    await config.save()
}

ipcMain.handle('FETCH_DATA', async () => {
    try {
        await fetchData()
        return { dataMap, current: config.current }
    } catch (e) {
        sendMsg(e.message || e, 'ERROR')
        console.error(e)
    }
})

ipcMain.handle('I18N_DATA', () => {
    return i18n.data
})

ipcMain.handle('LANG_MAP', () => {
    return langMap
})

ipcMain.handle('READ_DATA', async () => {
    await readData()
    return { dataMap, current: config.current }
})

ipcMain.handle('CHANGE_UID', (event, uid) => { changeCurrent(uid) })
ipcMain.handle('GET_CONFIG', () => config.value())
ipcMain.handle('SAVE_CONFIG', (event, [key, value]) => { config[key] = value; config.save() })
ipcMain.handle('NOTIFY_LANG_CHANGE', () => {
    // Broadcast language change to all renderer processes
    sendMsg('', 'LANG_CHANGED')
})
ipcMain.handle('OPEN_CACHE_FOLDER', () => { shell.openPath(userDataPath) })

// Delete or restore data
const deleteData = async (uid, action) => {
    const data = dataMap.get(uid)
    if (!data) return
    
    if (action === 'delete') {
        data.deleted = true
    } else if (action === 'restore') {
        delete data.deleted
    }
    
    await saveData(data)
}

// Get the latest URL from game logs
const getUrl = async () => {
    const allInfos = await extractEfWebview()
    if (!allInfos || allInfos.length === 0) return null
    
    const info = allInfos[0]
    return `${info.apiDomain}/api/record/char?token=${info.token}&lang=${info.lang}&server_id=${info.serverId}`
}

// Exports
exports.getData = () => ({ dataMap, current: config.current })
exports.deleteData = deleteData
exports.getUrl = getUrl