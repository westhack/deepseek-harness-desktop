'use strict';

/**
 * DeepSeek Harness Desktop IPC 通道常量
 * 主进程与渲染进程共享，避免散落字符串导致拼写错误
 */
const channels = {
  // DEEPSEEK HARNESS 业务通道（invoke 模型）
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
  // 事件推送通道（主进程 -> 渲染进程单向）
  stateChanged: 'dsh:state-changed',
  installProgress: 'dsh:install-progress',
  // DeepSeek Harness Desktop 自身更新通道
  appUpdateSnapshot: 'desktop-update:snapshot',
  appUpdateCheck: 'desktop-update:check',
  appUpdateDownload: 'desktop-update:download',
  appUpdateInstall: 'desktop-update:install',
  appUpdateChanged: 'desktop-update:changed'
};

module.exports = {
  channels
};
