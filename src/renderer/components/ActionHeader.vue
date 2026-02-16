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
              <el-dropdown-item command="import-json" divided>{{
                ui.button.import
              }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip
          v-if="hasData && state.status !== 'loading'"
          :content="ui.hint.newAccount"
          placement="bottom"
        >
          <el-button
            @click="newUser()"
            plain
            icon="plus"
            class="focus:outline-none"
          ></el-button>
        </el-tooltip>
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
      </div>
      <div class="flex gap-2 items-center">
        <el-select
          v-if="
            state.status !== 'loading' &&
            dataMap &&
            (dataMap.size > 1 || (dataMap.size === 1 && state.current === 0))
          "
          class="!w-44"
          @change="changeCurrent"
          v-model="uidSelectText"
        >
          <el-option
            v-for="item of dataMap"
            :key="item[0]"
            :label="maskUid(item[0])"
            :value="item[0]"
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

    <!-- Dialogs moved here as well -->
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
  urlInput: "",
  authkeyTimeout: false,
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

const uidSelectText = computed(() => {
  if (state.current === 0) {
    return ui.value?.select?.newAccount || "New Account";
  } else {
    return state.current;
  }
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
  const data = state.dataMap.get(state.current);
  if (!data) return true;
  if (Date.now() - data.time < 1000 * 10) return false;
  return true;
};

const fetchData = async (url) => {
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
  else if (type === "import-json") importData();
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

const importData = async () => {
  state.status = "loading";
  const data = await ipcRenderer.invoke("IMPORT_UIGF_JSON");
  if (data) {
    state.dataMap = data.dataMap;
    state.current = data.current;
    state.status = "loaded";
    emit('data-updated', { dataMap: state.dataMap, current: state.current });
  } else {
    state.status = "failed";
  }
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

const maskUid = (uid) => `${uid}`.replace(/(.{3})(.+)(.{3})$/, "$1***$3");

onMounted(async () => {
  await readData();
  ipcRenderer.on("LOAD_DATA_STATUS", (event, message) => state.log = message);
  ipcRenderer.on("UPDATE_HINT", (event, message) => {
    state.log = message;
    state.status = "updated";
  });
  ipcRenderer.on("AUTHKEY_TIMEOUT", (event, message) => state.authkeyTimeout = message);
});
</script>
