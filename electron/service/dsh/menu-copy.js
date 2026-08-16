'use strict';

/**
 * 主进程菜单/通知/气泡文案（zh-CN 与 en-US 两套）
 * 翻译自 deepseek-harness-desktop src/main/index.ts 的 mainCopy
 * @param {'zh-CN' | 'en-US'} locale
 */
function menuCopy(locale) {
  if (locale === 'en-US') {
    return {
      versionManager: 'Version Manager…', about: 'About DeepSeek Harness Desktop', checkUpdates: 'Check for DeepSeek Harness Desktop Updates…',
      language: 'Language', edit: 'Edit', window: 'Window', hide: 'Hide DeepSeek Harness Desktop', hideOthers: 'Hide Others', quit: 'Quit DeepSeek Harness Desktop',
      undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', minimize: 'Minimize', zoom: 'Zoom',
      version: (version) => `Version ${version}`,
      credits: 'DeepSeek Harness community desktop client',
      desktopUpdateTitle: (version) => `DeepSeek Harness Desktop ${version} is available`,
      desktopUpdateBody: 'A new version is available.',
      desktopUpdatePromptAuto: (version) => `Version ${version} is available. Update now to download and install automatically?`,
      desktopUpdatePromptManual: (version) => `Version ${version} is available. Open GitHub Releases to download it manually.`,
      promptUpdateNow: 'Update now',
      promptUpdateLater: 'Later',
      dshUpdateTitle: (version) => `DEEPSEEK HARNESS ${version} is available`,
      dshUpdateBody: (version) => `You are still using ${version}. Click to open Version Manager.`,
      dshWindowUpdateTag: (version) => `Update Available: v${version}`,
      openDshUpdateManager: (version) => `Update to v${version}`,
      dshPopoverUpdateAction: 'Update',
      trayShow: 'Show Main Window', trayQuit: 'Quit',
      trayTooltipRunning: (version) => `DEEPSEEK HARNESS Desktop · Running ${version}`,
      trayTooltipIdle: 'DEEPSEEK HARNESS Desktop',
      windowHiddenNotice: 'Application has been minimized to the tray.',
      trayDsh: 'DeepSeek Harness', trayVersionManager: 'Version Manager'
    };
  }
  return {
    versionManager: '版本管理…', about: '关于 DEEPSEEK HARNESS Desktop', checkUpdates: '检查 DEEPSEEK HARNESS Desktop 更新…',
    language: '语言', edit: '编辑', window: '窗口', hide: '隐藏 DEEPSEEK HARNESS Desktop', hideOthers: '隐藏其他应用', quit: '退出 DEEPSEEK HARNESS Desktop',
    undo: '撤销', redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', selectAll: '全选', minimize: '最小化', zoom: '缩放',
    version: (version) => `版本 ${version}`,
    credits: 'DeepSeek Harness 社区桌面客户端',
    desktopUpdateTitle: (version) => `DEEPSEEK HARNESS Desktop ${version} 可以更新`,
    desktopUpdateBody: '已检测到新版本。',
    desktopUpdatePromptAuto: (version) => `发现新版本 ${version}，是否立即下载并安装？`,
    desktopUpdatePromptManual: (version) => `发现新版本 ${version}，点击前往 GitHub Releases 手动下载。`,
    promptUpdateNow: '立即更新',
    promptUpdateLater: '稍后',
    dshUpdateTitle: (version) => `DEEPSEEK HARNESS ${version} 可以安装`,
    dshUpdateBody: (version) => `当前继续使用 ${version}。点击打开版本管理。`,
    dshWindowUpdateTag: (version) => `发现更新: v${version}`,
    openDshUpdateManager: (version) => `更新到 v${version}`,
    dshPopoverUpdateAction: '更新',
    trayShow: '显示主窗口', trayQuit: '退出',
    trayTooltipRunning: (version) => `DEEPSEEK HARNESS Desktop · 运行中 ${version}`,
    trayTooltipIdle: 'DEEPSEEK HARNESS Desktop',
    windowHiddenNotice: '应用已最小化到托盘。',
    trayDsh: 'DeepSeek Harness', trayVersionManager: '版本管理'
  };
}

module.exports = menuCopy;
