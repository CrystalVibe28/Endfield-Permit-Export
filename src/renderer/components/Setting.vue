<template>
  <teleport to="body">
    <div class="bg-white py-4 px-6 w-screen h-screen fixed inset-0 overflow-y-auto z-[9999]">
    <div class="flex content-center items-center mb-4 justify-between">
      <h3 class="text-lg">{{text.title}}</h3>
      <el-button icon="close" @click="closeSetting" plain circle type="default" class="w-8 h-8 shadow-md focus:shadow-none focus:outline-none fixed top-4 right-6"></el-button>
    </div>
    <el-form :model="settingForm" label-width="120px">
      <el-form-item :label="text.language">
        <el-select @change="saveLang" v-model="settingForm.lang" class="!w-44" :teleported="false">
          <el-option v-for="item of data.langMap" :key="item[0]" :label="item[1]" :value="item[0]"></el-option>
        </el-select>
        <p class="text-gray-400 text-xs m-1.5">{{text.languageHint}}</p>
      </el-form-item>
      <!-- <el-form-item :label="text.logType">
        <el-radio-group @change="saveSetting" v-model.number="settingForm.logType">
          <el-radio-button :label="0">{{text.auto}}</el-radio-button>
          <el-radio-button :label="1">{{text.cnServer}}</el-radio-button>
          <el-radio-button :label="2">{{text.seaServer}}</el-radio-button>
          <el-radio-button :label="3">{{text.manual}}</el-radio-button>
        </el-radio-group>
        <p class="text-gray-400 text-xs m-1.5">{{text.logTypeHint}}</p>
        <div v-if="settingForm.logType === 3" class="mt-2 w-full">
          <el-input 
            v-model="settingForm.manualUrl" 
            @change="saveSetting"
            :placeholder="text.manualUrlPlaceholder"
            clearable
          >
          </el-input>
          <p class="text-red-500 text-xs m-1.5 font-bold">{{text.manualWarning}}</p>
        </div>
      </el-form-item> -->

      <el-form-item :label="text.accountManage">
        <el-button type="primary" plain @click="state.showAccountDialog = true">{{text.accountManage}}</el-button>
        <p class="text-gray-400 text-xs m-1.5">{{text.accountManageHint}}</p>
      </el-form-item>
      <el-form-item :label="text.autoUpdate">
        <el-switch
          @change="saveSetting"
          v-model="settingForm.autoUpdate">
        </el-switch>
      </el-form-item>
      <!-- <el-form-item :label="text.hideNovice">
        <el-switch
          @change="saveSetting"
          v-model="settingForm.hideNovice">
        </el-switch>
      </el-form-item>
      <el-form-item :label="text.fetchFullHistory">
        <el-switch
          @change="saveSetting"
          v-model="settingForm.fetchFullHistory">
        </el-switch>
        <p class="text-gray-400 text-xs m-1.5">{{text.fetchFullHistoryHint}}</p>
      </el-form-item> -->
      <el-form-item :label="text.mergeSave">
        <el-button type="primary" plain @click="state.showMergeDialog = true">{{text.mergeSave}}</el-button>
        <p class="text-gray-400 text-xs m-1.5">{{text.mergeSaveHint}}</p>
      </el-form-item>
      <el-form-item :label="text.proxyMode">
        <el-switch
          @change="saveSetting"
          v-model="settingForm.proxyMode">
        </el-switch>
        <p class="text-gray-400 text-xs m-1.5">{{text.proxyModeHint}}</p>
        <el-button class="focus:outline-none" @click="disableProxy">{{text.closeProxy}}</el-button>
        <p class="text-gray-400 text-xs m-1.5">{{text.closeProxyHint}}</p>
      </el-form-item>
    </el-form>
    <h3 class="text-lg my-4">{{about.title}}</h3>
    <p class="text-gray-600 text-xs mt-1">{{about.license}}</p>
    <p class="text-gray-600 text-xs mt-1">{{about.forum}}: <a @click="openForum" class="cursor-pointer text-blue-400">https://forum.gamer.com.tw/C.php?bsn=74604&snA=771</a></p>
    <p class="text-gray-600 text-xs mt-1">Github: <a @click="openGithub" class="cursor-pointer text-blue-400">https://github.com/AiverAiva/Endfield-Permit-Export</a></p>
    <p class="text-gray-600 text-xs mt-1 pb-6">UIGF: <a @click="openUIGF" class="cursor-pointer text-blue-400">https://uigf.org/</a></p>
    <el-dialog v-model="state.showAccountDialog" :title="text.accountManage" width="90%" :append-to-body="false">
      <div class="">
        <el-table :data="state.linkedUsers" border stripe>
          <el-table-column property="uid" label="UID" width="140" />
          <el-table-column property="nickName" :label="text.nickName" width="120" />
          <el-table-column property="serverName" :label="text.server" width="120" />
          <el-table-column label="Token Status">
            <template #default="scope">
              <el-tag :type="scope.row.valid ? 'success' : 'danger'" size="small">
                {{ scope.row.valid ? text.tokenValid : text.tokenInvalid }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="common.action" width="100">
            <template #default="scope">
              <el-tooltip :content="text.logoutAccount" placement="top">
                <el-button :loading="state.actionLoading" size="small" icon="delete" plain type="danger" @click="logoutAccount(scope.row.uid)"></el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
    <MergeSave
      v-if="state.showMergeDialog"
      :i18n="props.i18n"
      @refreshData="emit('refreshData')"
      @close="state.showMergeDialog = false"
    />
    </div>
  </teleport>
</template>

<script setup>
const { ipcRenderer, shell } = require('electron')
import { reactive, onMounted, computed } from 'vue'
import MergeSave from './MergeSave.vue'

const emit = defineEmits(['close', 'changeLang', 'refreshData'])

const props = defineProps({
  i18n: Object,
  gachaDataInfo: Array
})

const data = reactive({
  langMap: new Map(),
})

const settingForm = reactive({
  lang: 'zh-cn',
  logType: 1,
  proxyMode: true,
  autoUpdate: true,
  fetchFullHistory: false,
  fetchFullHistory: false,
  hideNovice: true,
  manualUrl: ''
})

const state = reactive({
  showAccountDialog: false,
  showMergeDialog: false,
  actionLoading: false,
  linkedUsers: []
})

const common = computed(() => props.i18n.ui.common)
const text = computed(() => props.i18n.ui.setting)
const about = computed(() => props.i18n.ui.about)

const saveSetting = async () => {
  const keys = ['lang', 'proxyMode', 'autoUpdate', 'manualUrl']
  for (let key of keys) {
    await ipcRenderer.invoke('SAVE_CONFIG', [key, settingForm[key]])
  }
}

const saveLang = async () => {
  await saveSetting()
  // Notify main process to broadcast language change
  await ipcRenderer.invoke('NOTIFY_LANG_CHANGE')
  emit('changeLang')
}

const closeSetting = () => emit('close')

const disableProxy = async () => {
  await ipcRenderer.invoke('DISABLE_PROXY')
}

const openGithub = () => shell.openExternal('https://github.com/AiverAiva/Endfield-Permit-Export')
const openUIGF = () => shell.openExternal('https://uigf.org/')
const openForum = () => shell.openExternal('https://forum.gamer.com.tw/C.php?bsn=74604&snA=771')
const openLink = (link) => shell.openExternal(link)

const logoutAccount = async (uid) => {
  state.actionLoading = true
  const users = state.linkedUsers.filter(u => u.uid !== uid)
  await ipcRenderer.invoke('SAVE_CONFIG', ['users', JSON.parse(JSON.stringify(users))])
  state.linkedUsers = users
  state.actionLoading = false
  emit('refreshData')
}

const validateTokens = async (users) => {
  const list = []
  for (let user of users) {
    const valid = await ipcRenderer.invoke('VALIDATE_ACCOUNT_TOKEN', { 
      token: user.capturedToken || user.token, 
      provider: user.provider 
    })
    list.push({ ...user, valid })
  }
  state.linkedUsers = list
}

onMounted(async () => {
  data.langMap = await ipcRenderer.invoke('LANG_MAP')
  const config = await ipcRenderer.invoke('GET_CONFIG')
  Object.assign(settingForm, config)
  if (config.users) {
    await validateTokens(config.users)
  }
})

</script>

<style>
.el-form-item__label {
  line-height: normal !important;
  position: relative;
  top: 6px;
}
.el-form-item__content {
  flex-direction: column;
  align-items: start !important;
}
.el-form-item--default {
  margin-bottom: 14px !important;
}
</style>