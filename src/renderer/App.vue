<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <div class="w-48 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div class="p-4 border-b border-gray-200">
        <h1 class="font-bold text-gray-700">EF Permit Export</h1>
      </div>
      <el-menu
        :default-active="activePath"
        class="flex-1 border-r-0 bg-transparent"
        router
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>{{ i18n?.ui?.menu?.home }}</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <el-icon><DataLine /></el-icon>
          <span>{{ i18n?.ui?.menu?.statistics }}</span>
        </el-menu-item>
      </el-menu>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-auto bg-white p-6">
      <ActionHeader @data-updated="handleDataUpdate" @changeLang="getI18nData" />
      <router-view></router-view>
    </div>
  </div>
</template>

<script setup>
const { ipcRenderer } = require("electron");
import { reactive, onMounted, provide, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import ActionHeader from "./components/ActionHeader.vue";
import { version } from "../../package.json";

const route = useRoute();
const state = reactive({
  i18n: null,
  gachaState: {
    dataMap: new Map(),
    current: 0
  }
});

const activePath = computed(() => route.path);
const i18n = computed(() => state.i18n);

// Provide i18n and gachaState to children
provide("i18n", i18n);
provide("gachaState", computed(() => state.gachaState));

const handleDataUpdate = (data) => {
  state.gachaState = data;
};

const getI18nData = async () => {
  const data = await ipcRenderer.invoke("I18N_DATA");
  if (data) {
    state.i18n = data;
    setTitle();
  }
};

const setTitle = () => {
  if (state.i18n) {
    document.title = `${state.i18n.ui.win.title} - v${version}`;
  }
};

onMounted(async () => {
  await getI18nData();
  
  // Listen for language change events
  ipcRenderer.on('LANG_CHANGED', async () => {
    await getI18nData();
  });
});
</script>

<style>
/* Global overrides if necessary */
body {
  margin: 0;
  padding: 0;
  font-family:
    "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}
</style>
