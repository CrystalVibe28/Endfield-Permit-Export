<template>
  <div v-if="ui" class="action-header mb-6">
    <div class="flex justify-between items-center">
      <div class="space-x-3 flex items-center">
        <el-button
          type="primary"
          :icon="state.status === 'init' ? 'milk-tea' : 'refresh-right'"
          class="focus:outline-none"
          :disabled="!allowClick()"
          plain
          @click="fetchData()"
          :loading="state.status === 'loading'"
          >{{
            state.status === "init" ? ui.button.load : ui.button.update
          }}</el-button
        >
        <el-dropdown :disabled="!gachaData" @command="exportCommand">
          <el-button
            :disabled="!gachaData"
            icon="folder-opened"
            class="focus:outline-none"
            type="success"
            plain
          >
            {{ ui.button.files }}
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="excel">{{
                ui.button.excel
              }}</el-dropdown-item>
              <el-dropdown-item command="uigf-json">{{
                ui.button.uigf
              }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-tooltip
          v-if="state.status === 'updated'"
          :content="ui.hint.relaunchHint"
          placement="bottom"
        >
          <el-button
            @click="relaunch()"
            type="success"
            icon="refresh"
            class="focus:outline-none"
            style="margin-left: 24px"
            >{{ ui.button.directUpdate }}</el-button
          >
        </el-tooltip>
        <el-tooltip
          v-if="state.status !== 'loading'"
          :content="ui.hint.newAccount"
          placement="bottom"
        >
          <el-button
            @click="state.showLoginDlg = true"
            plain
            type="info"
            icon="user"
            class="focus:outline-none"
          >{{ ui.button.login }}</el-button>
        </el-tooltip>

      </div>
      <div class="flex gap-2 items-center">
        <el-select
          v-if="
            state.status !== 'loading' &&
            uidList.length > 0
          "
          class="!w-64"
          @change="changeCurrent"
          v-model="state.current"
        >
          <el-option
            v-for="item of uidList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
          </el-option>
        </el-select>
        <el-dropdown @command="optionCommand">
          <el-button
            @click="showSetting(true)"
            class="focus:outline-none"
            plain
            type="info"
            icon="more"
            >{{ ui.button.option }}</el-button
          >
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="setting" icon="setting">{{
                ui.button.setting
              }}</el-dropdown-item>
              <el-dropdown-item
                :disabled="!allowClick() || state.status === 'loading'"
                command="url"
                icon="link"
                >{{ ui.button.url }}</el-dropdown-item
              >
              <el-dropdown-item command="copyUrl" icon="DocumentCopy">{{
                ui.button.copyUrl
              }}</el-dropdown-item>
              <el-dropdown-item
                :disabled="!allowClick() || state.status === 'loading'"
                command="proxy"
                icon="position"
                >{{ ui.button.startProxy }}</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <p class="text-gray-400 my-2 text-xs flex items-center">
      {{ hint }}
      <el-button
        @click="state.showCacheCleanDlg = true"
        v-if="state.authkeyTimeout"
        style="margin-left: 8px"
        size="small"
        plain
        round
        >{{ ui.button.solution }}</el-button
      >
    </p>

    <!-- Dialogs -->
    <Setting
      v-if="state.showSetting"
      :i18n="i18n"
      :gacha-data-info="dataInfo"
      @refreshData="readData()"
      @changeLang="emit('changeLang')"
      @close="showSetting(false)"
    ></Setting>

    <el-dialog
      :title="ui.urlDialog.title"
      v-model="state.showUrlDlg"
      width="90%"
      class="max-w-md"
    >
      <p class="mb-4 text-gray-500">{{ ui.urlDialog.hint }}</p>
      <el-input
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 6 }"
        :placeholder="ui.urlDialog.placeholder"
        v-model="state.urlInput"
        spellcheck="false"
      ></el-input>
      <template #footer>
        <span class="dialog-footer">
          <el-button
            @click="state.showUrlDlg = false"
            class="focus:outline-none"
            >{{ ui.common.cancel }}</el-button
          >
          <el-button
            type="primary"
            @click="((state.showUrlDlg = false), fetchData(state.urlInput))"
            class="focus:outline-none"
            >{{ ui.common.ok }}</el-button
          >
        </span>
      </template>
    </el-dialog>

    <el-dialog
      :title="ui.button.solution"
      v-model="state.showCacheCleanDlg"
      width="90%"
      class="max-w-md cache-clean-dialog"
    >
      <el-button plain icon="folder" type="success" @click="openCacheFolder">{{
        ui.button.cacheFolder
      }}</el-button>
      <p class="my-2 flex flex-col text-teal-800 text-[13px]">
        <span class="my-1" v-for="txt of cacheCleanTextList" :key="txt">{{ txt }}</span>
      </p>
      <p class="my-2 text-gray-500 text-xs">{{ ui.extra.findCacheFolder }}</p>
      <template #footer>
        <div class="dialog-footer text-center">
          <el-button
            type="primary"
            @click="state.showCacheCleanDlg = false"
            class="focus:outline-none"
            >{{ ui.common.ok }}</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog
      :title="ui.loginDialog.title"
      v-model="state.showLoginDlg"
      width="90%"
      class="max-w-md"
    >
      <div class="flex flex-col gap-4">
        <el-select v-model="state.loginProvider" :placeholder="ui.loginDialog.server">
          <el-option :label="ui.setting.cnServer + ' (Hypergryph)'" value="hypergryph"></el-option>
          <el-option :label="ui.setting.seaServer + ' (Gryphline)'" value="gryphline"></el-option>
        </el-select>
        
        <el-button 
          v-if="!state.roles.length"
          type="primary" 
          @click="handleWebLogin" 
          :loading="state.isLoggingIn"
          class="w-full"
        >
          {{ ui.loginDialog.hint }}
        </el-button>

        <div v-if="state.roles.length" class="space-y-3">
          <p class="text-sm font-bold text-gray-700">{{ ui.loginDialog.roles }}</p>
          <div class="grid grid-cols-1 gap-2">
            <el-button 
              v-for="role in state.roles" 
              :key="role.roleId"
              @click="selectRole(role)"
              plain
              class="!ml-0"
            >
              {{ role.nickName }} ({{ role.roleId }})
</el-button>
        <el-tooltip
          v-if="hasData && state.status !== 'loading'"
          :content="ui.hint.newAccount"
          placement="bottom"
        >
          <span></span>
        </el-tooltip>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
const { ipcRenderer } = require("electron");
import { reactive, computed, onMounted, inject } from "vue";
import Setting from "./Setting.vue";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps(['modelValue']);

const emit = defineEmits(['update:modelValue', 'data-updated', 'changeLang']);

const i18n = inject("i18n");

const state = reactive({
  status: "init",
  log: "",
  dataMap: new Map(),
  current: 0,
  showSetting: false,
  showUrlDlg: false,
  showCacheCleanDlg: false,
  showLoginDlg: false,
  urlInput: "",
  authkeyTimeout: false,
  isLoggingIn: false,
  loginProvider: 'hypergryph',
  roles: [],
  capturedToken: null,
  oauthToken: null,
  linkedUsers: []
});


const ui = computed(() => i18n?.value?.ui);

const dataMap = computed(() => {
  const result = new Map();
  for (let [uid, data] of state.dataMap) {
    if (!data.deleted) {
      result.set(uid, data);
    }
  }
  return result;
});

const uidList = computed(() => {
  const list = [];
  if (state.dataMap.size === 0 && state.current === 0) {
    list.push({ label: ui.value?.select?.newAccount || "New Account", value: 0 });
  }

  // Files from local scan
  for (let [uid, data] of dataMap.value) {
    const linked = state.linkedUsers.find(u => u.uid === uid);
    const label = linked ? `${linked.nickName}(${linked.roleId})` : maskUid(uid);
    list.push({ label, value: uid });
  }

  // Linked accounts that might not have files yet
  for (let user of state.linkedUsers) {
    if (!dataMap.value.has(user.uid)) {
       list.push({ label: `${user.nickName}(${user.roleId})`, value: user.uid });
    }
  }

  return list;
});

const hasData = computed(() => {
    for (let [uid, data] of state.dataMap) {
        if (data.result && data.result.size > 0) return true;
    }
    return false;
});

const gachaData = computed(() => {
  return state.dataMap.get(state.current);
});

const dataInfo = computed(() => {
  const result = [];
  for (let [uid, data] of state.dataMap) {
    result.push({ uid, time: data.time, deleted: data.deleted });
  }
  return result;
});

const cacheCleanTextList = computed(() => {
  if (ui.value) {
    return ui.value.extra?.cacheClean?.split("\n");
  }
  return [];
});

const hint = computed(() => {
  const data = state.dataMap.get(state.current);
  if (!ui.value) return "...";
  
  const { hint } = ui.value;
  const { colon } = i18n.value.symbol;
  
  if (state.status === "init") return hint.init;
  if (state.status === "loaded") return `${hint.lastUpdate}${colon}${new Date(data.time).toLocaleString()}`;
  if (state.status === "loading") return state.log || "...";
  if (state.status === "updated") return state.log;
  if (state.status === "failed") return state.log + ` - ${hint.failed}`;
  return " ";
});

const allowClick = () => {
  const isLinked = state.linkedUsers.find(u => u.uid === state.current);
  if (!isLinked) return false;
  
  const data = state.dataMap.get(state.current);
  if (!data) return true;
  if (Date.now() - data.time < 1000 * 10) return false;
  return true;
};



const fetchData = async (url) => {
  const isLinked = state.linkedUsers.find(u => u.uid === state.current);
  if (isLinked) {
    state.status = "loading";
    state.log = "嘗試自動獲取最新 Token...";
    try {
      // 1. Try to get a totally fresh token from cookies (Auto Refresh)
      const freshToken = await ipcRenderer.invoke('AUTO_GET_TOKEN', isLinked.provider);
      if (freshToken) {
         return await selectRole({ ...isLinked, capturedToken: freshToken }, true);
      }
      
      // 2. Fallback: Try the stored capturedToken if it exists
      if (isLinked.capturedToken) {
        state.log = "使用存儲的 Token 嘗試更新...";
        return await selectRole(isLinked, true);
      }
    } catch (e) {
      console.warn("Auto refresh fallback failure", e);
    }
    
    ElMessage.warning("自動獲取 Token 失敗，請重新登入");
    state.showLoginDlg = true;
    state.status = "init";
    state.log = "";
    return;
  }


  state.log = "";
  state.status = "loading";
  const data = await ipcRenderer.invoke("FETCH_DATA", url);
  if (data) {
    state.dataMap = data.dataMap;
    state.current = data.current;
    state.status = "loaded";
    emit('data-updated', { dataMap: state.dataMap, current: state.current });
  } else {
    state.status = "failed";
  }
};

const handleWebLogin = async () => {
  state.isLoggingIn = true;
  try {
    const token = await ipcRenderer.invoke('OPEN_LOGIN_WINDOW', state.loginProvider);
    
    if (token) {
      state.capturedToken = token;
      const oauthToken = await ipcRenderer.invoke('GET_OAUTH_TOKEN', { 
        loginToken: token, 
        provider: state.loginProvider 
      });

      if (oauthToken) {
        state.oauthToken = oauthToken; // Store temporarily
        const bindings = await ipcRenderer.invoke('FETCH_UID_BY_TOKEN', { 
          oauthToken, 
          provider: state.loginProvider 
        });

        if (bindings && bindings.length > 0) {
          // Store hashUid (b.uid) for the next step
          state.roles = bindings.flatMap(b => b.roles.map(r => ({ ...r, hashUid: b.uid, provider: state.loginProvider })));
          if (state.roles.length === 1) {
            await selectRole(state.roles[0]);
          }
        } else {
          ElMessage.error("未找到角色信息");
          await ipcRenderer.invoke("CLEAR_LOGIN_SESSION");
        }
      } else {
        ElMessage.error("授權失敗 (請重試)");
        await ipcRenderer.invoke("CLEAR_LOGIN_SESSION");
      }
    }
  } catch (e) {
    console.error(e);
    ElMessage.error("登入程序發生錯誤");
    await ipcRenderer.invoke("CLEAR_LOGIN_SESSION");
  } finally {
    state.isLoggingIn = false;
  }
};

const selectRole = async (role, isAuto = false) => {
  state.showLoginDlg = false;
  state.status = "loading";
  state.log = isAuto ? "正在更新數據..." : "正在抓取資料...";
  
  const provider = role.provider || state.loginProvider;
  const apiDomain = provider === 'gryphline' 
    ? 'https://ef-webview.gryphline.com' 
    : 'https://ef-webview.hypergryph.com';

  // Token Chain: loginToken (capturedToken) -> oauthToken -> u8Token
  let loginToken = role.capturedToken || state.capturedToken;
  
  // If we are passing a fresh capturedToken (auto-refresh), 
  // we must ignore existing tokens and restart the chain.
  let oauthToken = role.capturedToken ? null : (role.oauthToken || state.oauthToken);
  let hashUid = role.hashUid || role.uid; // b.uid (hash)
  let u8Token = role.capturedToken ? null : role.token; // The final token for Gacha API


  try {
    // 1. If we only have loginToken, get oauthToken
    if (loginToken && !oauthToken) {
      // Pre-validate token before attempting exchange
      const isValid = await ipcRenderer.invoke('VALIDATE_ACCOUNT_TOKEN', {
        token: loginToken,
        provider
      });

      if (!isValid) {
        state.status = "failed";
        ElMessage.error(t('ui.hint.tokenExpired') || "帳號已過期，請重新登入");
        return;
      }

      state.log = "正在換取 OAuth Token...";
      oauthToken = await ipcRenderer.invoke('GET_OAUTH_TOKEN', {
        loginToken,
        provider
      });
    }

    // 2. If we have oauthToken, ensure we have hashUid and fetch u8Token
    // If it's a new login, bindings were fetched in handleWebLogin. 
    // If it's auto-refresh, hashUid should be in the 'role' object (from linkedUsers).
    if (oauthToken && hashUid) {
      state.log = "正在獲取 u8 token...";
      const freshU8 = await ipcRenderer.invoke('GET_U8_TOKEN_BY_UID', {
        uid: hashUid,
        oauthToken,
        provider
      });
      if (freshU8) u8Token = freshU8;
    }

    if (!u8Token) {
      state.status = "failed";
      ElMessage.error("獲取 Token 失敗，請重試");
      return;
    }

    const appUid = String(role.roleId); // roleId is the numeric game UID

    const data = await ipcRenderer.invoke("FETCH_DATA", {
      token: u8Token,
      serverId: role.serverId,
      roleId: role.roleId,
      lang: i18n.value?.lang || 'zh-cn',
      apiDomain,
      uid: appUid 
    });

    if (data) {
      state.dataMap = data.dataMap;
      state.current = appUid;
      state.status = "loaded";
      
      // Update/Save to linkedUsers
      const users = JSON.parse(JSON.stringify(state.linkedUsers));
      const newUser = {
          uid: appUid,
          gameUid: role.uid || role.hashUid, 
          roleId: role.roleId, 
          nickName: role.nickName,
          serverId: role.serverId,
          serverName: role.serverName,
          provider: provider,
          token: u8Token, 
          hashUid: hashUid,
          capturedToken: loginToken // Store the long-lived login token
      };
      const idx = users.findIndex(u => u.uid === appUid);
      if (idx !== -1) users[idx] = newUser;
      else users.push(newUser);
      state.linkedUsers = users;
      await ipcRenderer.invoke("SAVE_CONFIG", ["users", JSON.parse(JSON.stringify(users))]);

      await ipcRenderer.invoke("CLEAR_LOGIN_SESSION");

      if (!isAuto) {
        state.roles = [];
        state.capturedToken = null;
        state.oauthToken = null;
      }

      emit('data-updated', { dataMap: state.dataMap, current: state.current });
      if (!isAuto) ElMessage.success("數據抓取成功");
    } else {
      state.status = "failed";
      if (!isAuto) ElMessage.error("數據抓取失敗");
    }
  } catch (e) {
    console.error("selectRole error:", e);
    state.status = "failed";
    ElMessage.error("處理角色資訊時發生錯誤");
  }
};




const readData = async () => {
  const data = await ipcRenderer.invoke("READ_DATA");
  if (data) {
    state.dataMap = data.dataMap;
    state.current = data.current;
    if (data.dataMap.get(data.current)) {
      state.status = "loaded";
    }
    emit('data-updated', { dataMap: state.dataMap, current: state.current });
  }
  const config = await ipcRenderer.invoke("GET_CONFIG");
  state.linkedUsers = config.users || [];
};

const changeCurrent = async (uid) => {
  state.status = uid === 0 ? "init" : "loaded";
  state.current = uid;
  await ipcRenderer.invoke("CHANGE_UID", uid);
  emit('data-updated', { dataMap: state.dataMap, current: state.current });
};

const newUser = async () => await changeCurrent(0);
const relaunch = async () => await ipcRenderer.invoke("RELAUNCH");
const openCacheFolder = async () => await ipcRenderer.invoke("OPEN_CACHE_FOLDER");

const exportCommand = (type) => {
  if (type === "excel") ipcRenderer.invoke("SAVE_EXCEL");
  else if (type === "uigf-json") exportUIGFJSON();
};

const exportUIGFJSON = () => {
  let uidList = [];
  dataMap.value.forEach((item) => uidList.push(item.uid));

  ElMessageBox({
    title: ui.value.uigf.title,
    message: `<div>${uidList.map(uid => `<div><input type="checkbox" id="${uid}" value="${uid}" /><label for="${uid}">${uid}</label></div>`).join("")}</div>`,
    dangerouslyUseHTMLString: true,
    showCancelButton: true,
    confirmButtonText: ui.value.common.ok,
    cancelButtonText: ui.value.common.cancel,
    beforeClose: (action, instance, done) => {
      if (action === "confirm") {
        const selected_uids = uidList.filter(uid => document.getElementById(uid).checked);
        ipcRenderer.invoke("EXPORT_UIGF_JSON", selected_uids);
      }
      done();
    },
  }).catch(() => {});
};

const optionCommand = (type) => {
  if (type === "setting") showSetting(true);
  else if (type === "url") { state.urlInput = ""; state.showUrlDlg = true; }
  else if (type === "proxy") fetchData("proxy");
  else if (type === "copyUrl") copyUrl();
};


const showSetting = (show) => {
  state.showSetting = show;
};

const copyUrl = async () => {
  const successed = await ipcRenderer.invoke("COPY_URL");
  if (successed) ElMessage.success(ui.value.extra.urlCopied);
  else ElMessage.error(i18n.value.log.url.notFound);
};

const maskUid = (uid) => {
  if (!uid) return "";
  if (typeof uid !== 'string') uid = String(uid);
  return uid.replace(/(.{3})(.+)(.{3})$/, "$1***$3");
};

onMounted(async () => {
  await readData();
  ipcRenderer.on("LOAD_DATA_STATUS", (event, message) => state.log = message);
  ipcRenderer.on("UPDATE_HINT", (event, message) => {
    state.log = message;
    state.status = "updated";
  });
  ipcRenderer.on("AUTHKEY_TIMEOUT", (event, message) => state.authkeyTimeout = message);

  // Auto Refresh on startup
  for (let provider of ['hypergryph', 'gryphline']) {
    const freshToken = await ipcRenderer.invoke('AUTO_GET_TOKEN', provider);
    if (freshToken) {
       console.log(`Auto Refreshed Token for ${provider}`);
       // Update capturedToken for accounts using this provider if they are current
       const activeAccount = state.linkedUsers.find(u => u.uid === state.current && u.provider === provider);
       if (activeAccount) {
         state.capturedToken = freshToken;
       }
    }
  }
});
</script>
