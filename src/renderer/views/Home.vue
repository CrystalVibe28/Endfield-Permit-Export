<template>
  <div v-if="ui" class="relative">
    <div
      v-if="detail"
      class="gap-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4"
    >
      <div class="mb-4" v-for="(item, i) of detail" :key="i">
        <div :class="{ hidden: state.config.hideNovice && item[0] === '2' }">
          <p class="text-center text-gray-600 my-2">
            {{ typeMap.get(item[0]) }}
          </p>
          <pie-chart
            :data="item"
            :i18n="state.i18n"
            :typeMap="typeMap"
          ></pie-chart>
          <gacha-detail
            :i18n="state.i18n"
            :data="item"
            :typeMap="typeMap"
          ></gacha-detail>
        </div>
      </div>
    </div>
    
    <div v-else-if="state.current === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <el-icon class="text-6xl mb-4"><IceTea /></el-icon>
        <p>{{ ui.hint.init }}</p>
    </div>
  </div>
</template>

<script setup>
const { ipcRenderer } = require("electron");
import { reactive, computed, watch, onMounted, inject } from "vue";
import PieChart from "../components/PieChart.vue";
import GachaDetail from "../components/GachaDetail.vue";
import gachaDetail from "../gachaDetail";

const i18nFromApp = inject("i18n");
const gachaStateGlobal = inject("gachaState");

const state = reactive({
  dataMap: new Map(),
  current: 0,
  i18n: i18nFromApp?.value || null,
  config: {},
});

// Sync with global state
watch(() => gachaStateGlobal.value, (newVal) => {
  if (newVal) {
    state.dataMap = newVal.dataMap;
    state.current = newVal.current;
  }
}, { immediate: true, deep: true });

watch(() => i18nFromApp?.value, (newVal) => {
  if (newVal) state.i18n = newVal;
}, { immediate: true });

const ui = computed(() => state.i18n?.ui);

const dataMap = computed(() => {
  const result = new Map();
  for (let [uid, data] of state.dataMap) {
    if (!data.deleted) result.set(uid, data);
  }
  return result;
});

const detail = computed(() => {
  const data = dataMap.value.get(state.current);
  if (data) return gachaDetail(data.result);
  return null;
});

const typeMap = computed(() => {
  const result = new Map();
  const currentData = state.dataMap.get(state.current);
  if (currentData && currentData.typeMap) {
    if (typeof currentData.typeMap[Symbol.iterator] === "function") {
      for (const [key, val] of currentData.typeMap) result.set(key, val);
    } else if (typeof currentData.typeMap === "object") {
      for (const key in currentData.typeMap) result.set(key, currentData.typeMap[key]);
    }
  }
  if (state.i18n?.gacha?.type) {
    const types = state.i18n.gacha.type;
    for (const key in types) result.set(key, types[key]);
  }
  return result;
});

const updateConfig = async () => {
  state.config = await ipcRenderer.invoke("GET_CONFIG");
};

onMounted(async () => {
  await updateConfig();
});
</script>
