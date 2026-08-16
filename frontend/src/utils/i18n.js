/**
 * 渲染层国际化文案（zh-CN 与 en-US 两套）
 * 翻译自 deepseek-harness-desktop src/renderer/src.tsx 的 copy()
 * @param {'zh-CN' | 'en-US'} locale
 */
export function copy(locale) {
  if (locale === 'en-US') {
    return {
      readingState: 'Reading local state…', ready: 'Ready', completed: 'Completed', failed: 'Operation failed', appUpdateFailed: 'App update failed',
      versionManager: 'Version Manager', communityClient: 'DeepSeek Harness community desktop client',
      switchToEnglish: 'Switch to English', switchToChinese: '切换为中文', starOnGitHub: 'View on GitHub and star the project',
      currentDshVersion: 'Current DEEPSEEK HARNESS version', currentlyUsing: 'Currently using', dshNotInstalled: 'DEEPSEEK HARNESS is not installed',
      current: 'Current', bundled: 'Bundled', updateAvailable: 'Update available',
      quickUpdateAction: (version) => `Update to v${version}`,
      quickSwitching: (version) => `Switching to v${version}…`,
      quickInstalling: (version) => `Installing v${version}…`,
      quickUpdateTooltip: (version) => `A new DeepSeek Harness ${version} is available. Click to install or switch.`,
      quickUpdateBusy: 'Checking DEEPSEEK HARNESS update',
      officialFeaturesUnchanged: 'Launched by DeepSeek Harness Desktop. Official features and data remain unchanged.',
      stop: 'Stop', openDsh: 'Open DEEPSEEK HARNESS', startDsh: 'Start DEEPSEEK HARNESS',
      stoppingDsh: 'Stopping DEEPSEEK HARNESS…', openingDsh: 'Opening DEEPSEEK HARNESS…', startingDsh: 'Starting DEEPSEEK HARNESS…',
      versionFilters: 'Version filters', versions: 'Versions',
      allVersions: 'All versions', installed: 'Installed', available: 'Available',
      installedVersions: 'Installed versions', availableVersions: 'Available versions',
      versionSource: 'Version source', officialNpm: 'Official npm registry', officialNpmShort: 'Official npm',
      onlyOfficialLine1: 'Installs and runs only', onlyOfficialLine2: 'official DEEPSEEK HARNESS packages',
      searchVersion: 'Search versions', showPrerelease: 'Show prereleases', refreshVersions: 'Refresh official versions',
      syncingVersions: 'Syncing official npm versions…',
      versionCount: (count) => `${count} version${count === 1 ? '' : 's'}`,
      latest: 'Latest', inUse: 'In use', switching: 'Switching…', switch: 'Switch', installing: 'Installing…', install: 'Install',
      switchingTo: (version) => `Switching to ${version}…`,
      installingVersion: (version) => `Installing ${version}…`,
      noMatchingVersions: 'No matching versions',
      refreshEmpty: 'Refresh to load versions from the official npm registry.',
      adjustFilters: 'Try adjusting the filters or search.',
      unknown: 'Unknown', unknownPublishDate: 'Publish date unknown',
      notRunning: 'Not running', starting: 'Starting', dshRunning: 'DEEPSEEK HARNESS running', stopping: 'Stopping', runtimeError: 'Runtime error',
      newDesktopVersion: (version) => `Version ${version} is available. You decide whether to upgrade.`,
      newDesktopVersionManual: (version) => `Version ${version} is available. Open GitHub Releases to download it.`,
      newVersion: 'new version',
      downloadingDesktop: (version, percent) => `Downloading ${version} · ${percent}%`,
      desktopDownloaded: (version) => `${version} downloaded. Restart to install.`,
      checkingGitHub: 'Checking GitHub Releases for updates…',
      upToDate: 'You are up to date', cannotCheckUpdates: 'Unable to check for updates',
      independentUpdates: 'DeepSeek Harness Desktop updates come from GitHub Releases and are separate from official DEEPSEEK HARNESS versions',
      downloadUpdate: 'Download update', openDownloadPage: 'Open GitHub download page',
      restartInstall: 'Restart and install', checking: 'Checking…', checkAgain: 'Check again',
      releaseOnly: 'Available in release builds only', checkUpdates: 'Check for updates',
      followSystem: 'Follow system', localeChanged: 'Language changed', localeChangeFailed: 'Failed to change language',
      registrySource: 'Registry', officialRegistry: 'npm official', npmmirrorRegistry: 'China mirror (npmmirror)',
      registryChanged: 'Registry changed', registryChangeFailed: 'Failed to change registry',
    };
  }
  return {
    readingState: '正在读取本机状态…', ready: '准备就绪', completed: '操作完成', failed: '操作失败', appUpdateFailed: '应用更新失败',
    versionManager: '版本管理', communityClient: 'DeepSeek Harness 社区桌面客户端',
    switchToEnglish: '切换为英文', switchToChinese: '切换为中文', starOnGitHub: '在 GitHub 查看并 Star 项目',
    currentDshVersion: '当前 DEEPSEEK HARNESS 版本', currentlyUsing: '当前使用', dshNotInstalled: '尚未安装 DEEPSEEK HARNESS',
    current: '当前', bundled: '随应用提供', updateAvailable: '可更新',
    quickUpdateAction: (version) => `更新到 v${version}`,
    quickSwitching: (version) => `正在切换到 v${version}…`,
    quickInstalling: (version) => `正在安装 v${version}…`,
    quickUpdateTooltip: (version) => `发现 DeepSeek Harness ${version}，点击安装或切换。`,
    quickUpdateBusy: '正在检查 DEEPSEEK HARNESS 更新',
    officialFeaturesUnchanged: '由 DeepSeek Harness Desktop 启动，官方功能和数据保持原样。',
    stop: '停止', openDsh: '打开 DEEPSEEK HARNESS', startDsh: '启动 DEEPSEEK HARNESS',
    stoppingDsh: '正在停止 DEEPSEEK HARNESS…', openingDsh: '正在打开 DEEPSEEK HARNESS…', startingDsh: '正在启动 DEEPSEEK HARNESS…',
    versionFilters: '版本筛选', versions: '版本',
    allVersions: '全部版本', installed: '已安装', available: '可安装',
    installedVersions: '已安装版本', availableVersions: '可安装版本',
    versionSource: '版本来源', officialNpm: 'npm 官方源', officialNpmShort: '官方 npm',
    onlyOfficialLine1: '仅安装并运行', onlyOfficialLine2: '官方 DEEPSEEK HARNESS 包',
    searchVersion: '搜索版本号', showPrerelease: '显示预发布版本', refreshVersions: '刷新官方版本',
    syncingVersions: '正在同步 npm 官方版本…',
    versionCount: (count) => `${count} 个版本`,
    latest: '最新', inUse: '使用中', switching: '切换中…', switch: '切换', installing: '安装中…', install: '安装',
    switchingTo: (version) => `正在切换到 ${version}…`,
    installingVersion: (version) => `正在安装 ${version}…`,
    noMatchingVersions: '没有符合条件的版本',
    refreshEmpty: '点击右上角刷新，从 npm 官方源获取版本。',
    adjustFilters: '试试调整筛选或搜索内容。',
    unknown: '未知', unknownPublishDate: '发布时间未知',
    notRunning: '未运行', starting: '启动中', dshRunning: 'DEEPSEEK HARNESS 运行中', stopping: '停止中', runtimeError: '运行异常',
    newDesktopVersion: (version) => `发现新版 ${version}，是否升级由你决定`,
    newDesktopVersionManual: (version) => `发现新版 ${version}，请前往 GitHub Releases 下载`,
    newVersion: '新版',
    downloadingDesktop: (version, percent) => `正在下载 ${version} · ${percent}%`,
    desktopDownloaded: (version) => `${version} 已下载，重启后安装`,
    checkingGitHub: '正在从 GitHub Releases 检查更新…',
    upToDate: '当前已是最新版', cannotCheckUpdates: '暂时无法检查更新',
    independentUpdates: 'DeepSeek Harness Desktop 更新来自 GitHub Releases，与官方 DEEPSEEK HARNESS 版本独立',
    downloadUpdate: '下载更新', openDownloadPage: '打开 GitHub 下载页',
    restartInstall: '重启并安装', checking: '检查中…', checkAgain: '再次检查',
    releaseOnly: '仅正式版可用', checkUpdates: '检查更新',
    followSystem: '跟随系统', localeChanged: '语言已切换', localeChangeFailed: '语言切换失败',
    registrySource: '镜像源', officialRegistry: 'npm 官方源', npmmirrorRegistry: '国内镜像 (npmmirror)',
    registryChanged: '镜像源已切换', registryChangeFailed: '镜像源切换失败',
  };
}

/**
 * 把主进程的中文错误消息翻译成英文（中文直接返回）
 */
export function localizeMessage(locale, message) {
  if (typeof message !== 'string' || message === '') return '';
  if (locale === 'zh-CN') return message;
  const exact = {
    '正在读取本机状态…': 'Reading local state…', '准备就绪': 'Ready', '操作完成': 'Completed', '操作失败': 'Operation failed',
    '应用更新失败': 'App update failed', '开发模式不检查应用更新': 'App updates are unavailable in development mode',
    '当前已是最新版': 'You are up to date', '更新已下载，重启后安装': 'Update downloaded. Restart to install.',
    '当前没有可下载的 DeepSeek Harness Desktop 更新': 'No DeepSeek Harness Desktop update is available to download',
    '更新尚未下载完成': 'The update has not finished downloading',
    '此平台需要从 GitHub Releases 手动下载更新': 'Download the update manually from GitHub Releases on this platform',
    '此平台需要从 GitHub Releases 手动安装更新': 'Install the update manually from GitHub Releases on this platform',
    '尚未发布可供自动更新的正式版本': 'No published release is currently available for automatic updates',
    '内置 Node.js 运行环境不可用': 'The bundled Node.js runtime is unavailable',
    '检查版本失败': 'Could not check versions',
    '已有 DEEPSEEK HARNESS 版本正在安装': 'Another DEEPSEEK HARNESS version is already being installed',
    '安装失败': 'Installation failed',
    '请先停止正在运行的 DSH': 'Stop the running DSH instance first',
    '请先安装并选择一个 DSH 版本': 'Install and select a DSH version first',
    '启动失败': 'Could not start DSH',
    '无法查询官方 DSH 版本': 'Could not query official DSH versions',
    'npm registry 未返回有效的 latest 版本': 'The npm registry did not return a valid latest version',
    '该版本不在官方 npm 版本目录中': 'This version is not listed in the official npm catalog',
    '正在校验官方包版本和入口': 'Validating the official package version and entry point',
    '官方 DSH 包身份或版本校验失败': 'Official DSH package identity or version validation failed',
    '官方 DSH 包未提供 dsh CLI 入口': 'The official DSH package does not provide a dsh CLI entry point',
    '官方 DSH CLI 入口无效': 'The official DSH CLI entry point is invalid',
    '命令执行超时': 'Command timed out',
    'DSH 已经在运行': 'DSH is already running',
    '官方 DSH 在规定时间内未返回本地访问地址': 'Official DSH did not provide a local URL in time',
    '无法启动官方 DSH 进程': 'Could not start the official DSH process',
  };
  if (exact[message]) return exact[message];
  return message
    .replace(/^正在安装官方 DSH (.+)$/, 'Installing official DSH $1')
    .replace(/^正在安装依赖：(.+)$/, 'Installing dependencies: $1')
    .replace(/^DSH (.+) 已安装$/, 'DSH $1 installed')
    .replace(/^检查更新失败：/, 'Update check failed: ')
    .replace(/^官方 DSH 启动失败（退出码 (.+)）$/, 'Official DSH failed to start (exit code $1)')
    .replace(/^官方 DSH 启动失败（退出码 (.+)）：/, 'Official DSH failed to start (exit code $1): ')
    .replace(/^npm 安装失败（退出码 (.+)）：/, 'npm installation failed (exit code $1): ');
}
