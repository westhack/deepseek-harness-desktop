'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * IPC 通道常量（内联，避免 sandbox 模式下 require 本地模块失败）
 * 与 electron/shared/ipc-channels.js 保持同步
 */
const channels = {
  snapshot: 'dsh:snapshot',
  refresh: 'dsh:refresh',
  install: 'dsh:install',
  select: 'dsh:select',
  launch: 'dsh:launch',
  stop: 'dsh:stop',
  dismissUpdate: 'dsh:dismiss-update',
  openExternal: 'dsh:open-external',
  setLocale: 'desktop:set-locale',
  setRegistry: 'desktop:set-registry',
  stateChanged: 'dsh:state-changed',
  installProgress: 'dsh:install-progress',
  appUpdateSnapshot: 'desktop-update:snapshot',
  appUpdateCheck: 'desktop-update:check',
  appUpdateDownload: 'desktop-update:download',
  appUpdateInstall: 'desktop-update:install',
  appUpdateChanged: 'desktop-update:changed',
  pluginInstall: 'dsh:plugin-install',
  pluginProgress: 'dsh:plugin-progress',
  readClipboard: 'dsh:read-clipboard',
  writeClipboard: 'dsh:write-clipboard',
  pluginMarketFetch: 'dsh:plugin-market-fetch',
  pluginRunCommand: 'dsh:plugin-run-command',
  pluginSourcesSet: 'dsh:plugin-sources-set',
  // 备份与恢复
  backupExport: 'dsh:backup-export',
  backupImport: 'dsh:backup-import',
  backupLocalSave: 'dsh:backup-local-save',
  backupLocalLoad: 'dsh:backup-local-load',
  backupConfigSet: 'dsh:backup-config-set',
  backupWebdavTest: 'dsh:backup-webdav-test',
  backupWebdavPush: 'dsh:backup-webdav-push',
  backupWebdavPull: 'dsh:backup-webdav-pull',
  backupGistTest: 'dsh:backup-gist-test',
  backupGistPush: 'dsh:backup-gist-push',
  backupGistPull: 'dsh:backup-gist-pull',
  backupAutoRun: 'dsh:backup-auto-run'
};

/**
 * preload bridge：通过 contextBridge 暴露 dshDesktop API 到渲染进程
 * 所有方法都是 ipcRenderer.invoke 的薄封装
 * 三个 on*Changed 方法返回取消订阅函数
 * 不泄漏任何 Node 能力到渲染层
 */
const api = {
  getSnapshot: () => ipcRenderer.invoke(channels.snapshot),
  refresh: () => ipcRenderer.invoke(channels.refresh),
  install: (version) => ipcRenderer.invoke(channels.install, version),
  select: (version) => ipcRenderer.invoke(channels.select, version),
  launch: () => ipcRenderer.invoke(channels.launch),
  stop: () => ipcRenderer.invoke(channels.stop),
  dismissUpdate: (version) => ipcRenderer.invoke(channels.dismissUpdate, version),
  openExternal: (url) => ipcRenderer.invoke(channels.openExternal, url),
  setLocale: (preference) => ipcRenderer.invoke(channels.setLocale, preference),
  setRegistry: (preference) => ipcRenderer.invoke(channels.setRegistry, preference),
  getAppUpdate: () => ipcRenderer.invoke(channels.appUpdateSnapshot),
  checkAppUpdate: () => ipcRenderer.invoke(channels.appUpdateCheck),
  downloadAppUpdate: () => ipcRenderer.invoke(channels.appUpdateDownload),
  installAppUpdate: () => ipcRenderer.invoke(channels.appUpdateInstall),
  onStateChanged: (listener) => {
    const handler = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on(channels.stateChanged, handler);
    return () => ipcRenderer.removeListener(channels.stateChanged, handler);
  },
  onInstallProgress: (listener) => {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on(channels.installProgress, handler);
    return () => ipcRenderer.removeListener(channels.installProgress, handler);
  },
  onAppUpdateChanged: (listener) => {
    const handler = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on(channels.appUpdateChanged, handler);
    return () => ipcRenderer.removeListener(channels.appUpdateChanged, handler);
  },
  readClipboard: () => ipcRenderer.invoke(channels.readClipboard),
  writeClipboard: (text) => ipcRenderer.invoke(channels.writeClipboard, String(text)),
  installPlugin: (command) => ipcRenderer.invoke(channels.pluginInstall, command),
  runPluginCommand: (command) => ipcRenderer.invoke(channels.pluginRunCommand, command),
  fetchPluginMarket: (source) => ipcRenderer.invoke(channels.pluginMarketFetch, source),
  setPluginSources: (sources) => ipcRenderer.invoke(channels.pluginSourcesSet, sources),
  // 备份与恢复
  backupExport: (profile) => ipcRenderer.invoke(channels.backupExport, profile),
  backupImport: (backup) => ipcRenderer.invoke(channels.backupImport, backup),
  backupLocalSave: (backup, defaultName) => ipcRenderer.invoke(channels.backupLocalSave, backup, defaultName),
  backupLocalLoad: () => ipcRenderer.invoke(channels.backupLocalLoad),
  backupSetConfig: (config) => ipcRenderer.invoke(channels.backupConfigSet, config),
  backupWebdavTest: (config) => ipcRenderer.invoke(channels.backupWebdavTest, config),
  backupWebdavPush: (backup, config) => ipcRenderer.invoke(channels.backupWebdavPush, backup, config),
  backupWebdavPull: (config) => ipcRenderer.invoke(channels.backupWebdavPull, config),
  backupGistTest: (config) => ipcRenderer.invoke(channels.backupGistTest, config),
  backupGistPush: (backup, config) => ipcRenderer.invoke(channels.backupGistPush, backup, config),
  backupGistPull: (config) => ipcRenderer.invoke(channels.backupGistPull, config),
  backupAutoRun: () => ipcRenderer.invoke(channels.backupAutoRun),
  onPluginProgress: (listener) => {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on(channels.pluginProgress, handler);
    return () => ipcRenderer.removeListener(channels.pluginProgress, handler);
  }
};

contextBridge.exposeInMainWorld('dshDesktop', api);
