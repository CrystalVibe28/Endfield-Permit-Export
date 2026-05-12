<template>
  <teleport to="body">
    <div class="bg-white py-4 px-6 w-screen h-screen fixed inset-0 overflow-y-auto z-[9999]">
      <div class="flex content-center items-center mb-4 justify-between">
        <h3 class="text-lg">{{ ui.title }}</h3>
        <el-button icon="close" @click="closeDialog" plain circle type="default"
          class="w-8 h-8 shadow-md focus:shadow-none focus:outline-none fixed top-4 right-6"></el-button>
      </div>

      <div v-if="state.step === 'select'" class="flex flex-col lg:flex-row gap-6">
        <!-- Left: Old file selection -->
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-sm mb-3 text-gray-700">{{ ui.selectOld }}</h4>
          <el-button type="primary" plain @click="pickOldFile" icon="folder-opened" class="mb-3">
            {{ ui.browse }}
          </el-button>
          <div v-if="state.oldFile" class="border rounded-lg p-3 bg-gray-50 text-sm">
            <p class="font-medium text-gray-800 truncate">{{ state.oldFile.fileName }}</p>
            <p class="text-gray-500 text-xs mt-1">{{ ui.oldUid }}: {{ state.oldFile.uid }}</p>
            <div class="flex gap-4 mt-2 text-xs text-gray-600">
              <span>{{ ui.chars }}: {{ state.oldFile.charCount }}</span>
              <span>{{ ui.weapons }}: {{ state.oldFile.wepCount }}</span>
              <span>{{ ui.total }}: {{ state.oldFile.recordCount }}</span>
            </div>
          </div>
          <p v-else class="text-gray-400 text-xs">{{ ui.noFile }}</p>
        </div>

        <!-- Right: Target account selection -->
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-sm mb-3 text-gray-700">{{ ui.selectTarget }}</h4>
          <div v-if="state.targets.length === 0" class="text-gray-400 text-xs">
            {{ ui.noTarget }}
          </div>
          <el-radio-group v-else v-model="state.selectedTarget" class="!flex !flex-col gap-2">
            <el-radio v-for="t in state.targets" :key="t.uid" :label="t.uid" border
              class="!mr-0 !h-auto !py-2 !px-3 w-full">
              <div class="flex flex-col">
                <span class="font-medium text-sm">{{ t.uid }}</span>
                <span class="text-xs text-gray-400">
                  {{ t.fileName }} &mdash; {{ ui.chars }}: {{ t.charCount }}, {{ ui.weapons }}: {{ t.wepCount }}
                </span>
              </div>
            </el-radio>
          </el-radio-group>
        </div>
      </div>

      <!-- Preview step -->
      <div v-if="state.step === 'preview'" class="space-y-4">
        <h4 class="font-semibold text-sm text-gray-700">{{ ui.preview }}</h4>

        <div class="border rounded-lg p-4 bg-gray-50 text-sm space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-500">{{ ui.oldRecords }}</span>
            <span class="font-medium">{{ state.preview.oldTotal }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ ui.toAdd }}</span>
            <span class="font-medium text-green-600">+{{ state.preview.addTotal }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ ui.skipped }}</span>
            <span class="font-medium text-gray-400">{{ state.preview.overlapTotal }}</span>
          </div>

          <div v-if="state.preview.charOverlapRange || state.preview.wepOverlapRange" class="border-t pt-2 mt-2 space-y-1">
            <p v-if="state.preview.charOverlapRange" class="text-xs text-amber-600">
              {{ ui.chars }} {{ ui.overlapRange }}: seqId {{ state.preview.charOverlapRange.min }} ~ {{ state.preview.charOverlapRange.max }}
              ({{ state.preview.overlapCharCount }} {{ ui.records }})
            </p>
            <p v-if="state.preview.wepOverlapRange" class="text-xs text-amber-600">
              {{ ui.weapons }} {{ ui.overlapRange }}: seqId {{ state.preview.wepOverlapRange.min }} ~ {{ state.preview.wepOverlapRange.max }}
              ({{ state.preview.overlapWepCount }} {{ ui.records }})
            </p>
          </div>
        </div>

        <!-- Gap warnings -->
        <div v-if="state.preview.hasGaps" class="border border-red-200 rounded-lg p-4 bg-red-50">
          <p class="text-red-600 font-semibold text-sm mb-2">{{ ui.gapWarning }}</p>
          <div v-if="state.preview.charGaps.length > 0" class="text-xs text-red-500 mb-1">
            <p class="font-medium">{{ ui.chars }}:</p>
            <p v-for="(g, i) in state.preview.charGaps" :key="'cg' + i" class="ml-2">
              seqId {{ g.start }} ~ {{ g.end }} ({{ g.count }} {{ ui.records }})
            </p>
          </div>
          <div v-if="state.preview.wepGaps.length > 0" class="text-xs text-red-500">
            <p class="font-medium">{{ ui.weapons }}:</p>
            <p v-for="(g, i) in state.preview.wepGaps" :key="'wg' + i" class="ml-2">
              seqId {{ g.start }} ~ {{ g.end }} ({{ g.count }} {{ ui.records }})
            </p>
          </div>
        </div>

        <div v-if="!state.preview.hasGaps && state.preview.overlapTotal === 0"
          class="border border-green-200 rounded-lg p-3 bg-green-50 text-green-600 text-sm">
          {{ ui.noIssues }}
        </div>
      </div>

      <!-- Result step -->
      <div v-if="state.step === 'result'" class="space-y-4">
        <div v-if="state.result.success"
          class="border border-green-200 rounded-lg p-4 bg-green-50 text-green-700 text-sm space-y-1">
          <p class="font-semibold">{{ ui.mergeSuccess }}</p>
          <p>{{ ui.chars }}: +{{ state.result.charAdded }}, {{ ui.weapons }}: +{{ state.result.wepAdded }}</p>
          <p>{{ ui.skipped }}: {{ state.result.charSkipped + state.result.wepSkipped }}</p>
          <p class="text-xs text-green-600 mt-2">{{ ui.backupInfo }}: {{ state.result.backupDir }}</p>
          <p class="text-xs text-green-600">{{ ui.deletedOld }}</p>
        </div>
        <div v-else class="border border-red-200 rounded-lg p-4 bg-red-50 text-red-600 text-sm">
          <p class="font-semibold">{{ ui.mergeFailed }}</p>
          <p>{{ state.result.error }}</p>
        </div>
      </div>

      <!-- Footer buttons -->
      <div class="flex justify-end gap-3 mt-6 pt-4 border-t">
        <el-button v-if="state.step === 'select'" @click="closeDialog" class="focus:outline-none">
          {{ common.cancel }}
        </el-button>
        <el-button v-if="state.step === 'preview'" @click="state.step = 'select'" class="focus:outline-none">
          {{ common.back || common.cancel }}
        </el-button>
        <el-button v-if="state.step === 'result'" type="primary" @click="closeDialog"
          class="focus:outline-none">
          {{ common.ok }}
        </el-button>
        <el-button v-if="state.step === 'select'" type="primary" :disabled="!canPreview" @click="doPreview"
          :loading="state.loading" class="focus:outline-none">
          {{ ui.preview }}
        </el-button>
        <el-button v-if="state.step === 'preview'" type="danger" @click="doMerge" :loading="state.loading"
          class="focus:outline-none">
          {{ ui.confirm }}
        </el-button>
      </div>
    </div>
  </teleport>
</template>

<script setup>
const { ipcRenderer } = require('electron')
import { reactive, computed, onMounted } from 'vue'

const emit = defineEmits(['close', 'refreshData'])

const props = defineProps({
  i18n: Object
})

const mergeText = computed(() => props.i18n?.ui?.merge || {})
const common = computed(() => props.i18n?.ui?.common || {})
const settingText = computed(() => props.i18n?.ui?.setting || {})

const ui = computed(() => {
  const m = mergeText.value
  const c = common.value
  return {
    title: m.title || '合併存檔',
    selectOld: m.selectOld || '選擇舊版存檔',
    selectTarget: m.selectTarget || '選擇目標帳號',
    browse: m.browse || '瀏覽...',
    noFile: m.noFile || '尚未選擇檔案',
    noTarget: m.noTarget || '無可用帳號',
    oldUid: m.oldUid || '舊版 UID',
    chars: m.chars || '角色',
    weapons: m.weapons || '武器',
    total: m.total || '總計',
    preview: m.preview || '合併預覽',
    oldRecords: m.oldRecords || '舊版紀錄筆數',
    toAdd: m.toAdd || '將新增',
    skipped: m.skipped || '已跳過（新版已有）',
    overlapRange: m.overlapRange || '重疊 seqId 範圍',
    records: m.records || '筆',
    gapWarning: m.gapWarning || '偵測到 seqId 不連續，合併後仍可能存在資料缺口',
    noIssues: m.noIssues || '無衝突，可安全合併',
    confirm: m.confirm || '確認合併',
    mergeSuccess: m.mergeSuccess || '合併完成',
    mergeFailed: m.mergeFailed || '合併失敗',
    backupInfo: m.backupInfo || '備份已保存至',
    deletedOld: m.deletedOld || '舊版檔案已刪除（已備份）',
    loading: m.loading || '處理中...',
  }
})

const state = reactive({
  step: 'select',
  loading: false,
  oldFile: null,
  targets: [],
  selectedTarget: null,
  preview: null,
  result: null,
})

const canPreview = computed(() => state.oldFile && state.selectedTarget)

const pickOldFile = async () => {
  const result = await ipcRenderer.invoke('OPEN_MERGE_FILE_DIALOG')
  if (result) {
    state.oldFile = result
  }
}

const doPreview = async () => {
  if (!canPreview.value) return
  state.loading = true
  try {
    const preview = await ipcRenderer.invoke('GET_MERGE_PREVIEW', {
      oldFilePath: state.oldFile.filePath,
      targetUid: state.selectedTarget,
    })
    if (preview.error) {
      state.result = preview
      state.step = 'result'
    } else {
      state.preview = preview
      state.step = 'preview'
    }
  } catch (e) {
    state.result = { error: e.message }
    state.step = 'result'
  } finally {
    state.loading = false
  }
}

const doMerge = async () => {
  state.loading = true
  try {
    const result = await ipcRenderer.invoke('EXECUTE_MERGE', {
      oldFilePath: state.oldFile.filePath,
      targetUid: state.selectedTarget,
    })
    state.result = result
    state.step = 'result'
    if (result.success) {
      emit('refreshData')
    }
  } catch (e) {
    state.result = { error: e.message }
    state.step = 'result'
  } finally {
    state.loading = false
  }
}

const closeDialog = () => emit('close')

onMounted(async () => {
  state.targets = await ipcRenderer.invoke('GET_MERGE_TARGET_LIST')
})
</script>
