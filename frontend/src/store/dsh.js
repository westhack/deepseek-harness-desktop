import { reactive } from 'vue';

/**
 * DEEPSEEK HARNESS 状态管理（轻量 reactive，不引入 pinia）
 * 通过 window.dshDesktop（preload bridge 暴露）与主进程通信
 */

const initialLocale = (navigator.language || 'zh-CN').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';

const state = reactive({
  // AppSnapshot
  snapshot: {
    appVersion: '0.0.0',
    locale: initialLocale,
    localePreference: 'system',
    registryPreference: 'official',
    pluginSources: [],
    backupConfig: null,
    nodeVersion: null,
    latestVersion: null,
    selectedVersion: null,
    dismissedLatest: null,
    installedVersions: [],
    availableVersions: [],
    runtimeStatus: 'idle',
    runtimeUrl: null,
    error: null,
  },
  // AppUpdateSnapshot
  appUpdate: {
    currentVersion: '0.0.0',
    availableVersion: null,
    delivery: 'manual',
    status: 'idle',
    percent: null,
    message: null,
  },
  // 安装进度
  progress: null,
  // 当前繁忙操作 key（非 null 时所有按钮 disabled）
  busyAction: null,
  // 底部状态消息
  message: '',
});

let initialized = false;
const stateListeners = new Set();
const progressListeners = new Set();
const appUpdateListeners = new Set();

/**
 * 初始化：获取初始快照并订阅事件
 */
async function init() {
  if (initialized) return;
  initialized = true;

  const api = window.dshDesktop;
  if (!api) {
    state.message = 'window.dshDesktop unavailable';
    return;
  }

  try {
    const snapshot = await api.getSnapshot();
    Object.assign(state.snapshot, snapshot);
    document.documentElement.lang = snapshot.locale;
    state.message = '';
    state.busyAction = null;
  } catch (error) {
    state.message = error instanceof Error ? error.message : 'init failed';
  }

  // 自动刷新官方版本列表（不阻塞初始化，失败不影响已有快照）
  try {
    const refreshed = await api.refresh();
    Object.assign(state.snapshot, refreshed);
  } catch {
    // 网络失败不影响本地已安装版本展示
  }

  try {
    const appUpdate = await api.getAppUpdate();
    Object.assign(state.appUpdate, appUpdate);
  } catch {
    // ignore
  }

  api.onStateChanged((snapshot) => {
    Object.assign(state.snapshot, snapshot);
    stateListeners.forEach((fn) => fn(snapshot));
  });

  api.onInstallProgress((progress) => {
    state.progress = progress;
    state.message = progress.message;
    progressListeners.forEach((fn) => fn(progress));
  });

  api.onAppUpdateChanged((snapshot) => {
    Object.assign(state.appUpdate, snapshot);
    appUpdateListeners.forEach((fn) => fn(snapshot));
  });
}

function useDshStore() {
  return {
    get snapshot() { return state.snapshot; },
    get appUpdate() { return state.appUpdate; },
    get progress() { return state.progress; },
    get busyAction() { return state.busyAction; },
    set busyAction(value) { state.busyAction = value; },
    get message() { return state.message; },
    set message(value) { state.message = value; },
    state,
    init,
  };
}

export { useDshStore, state, init };
