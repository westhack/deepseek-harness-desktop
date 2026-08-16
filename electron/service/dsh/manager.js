'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, Notification, session, shell, Tray } = require('electron');
const electronUpdater = require('electron-updater');
const path = require('node:path');
const semver = require('semver');
const { logger } = require('ee-core/log');
const { getMainWindow } = require('ee-core/electron');
const { isDev } = require('ee-core/ps');

const { channels, parseExactVersion, parseLocalePreference, parseRegistryPreference } = require('../../shared/contracts');
const { AppController } = require('./controller');
const { DshSupervisor } = require('./dsh-supervisor');
const { DshRegistry } = require('./registry');
const { VersionManager } = require('./version-manager');
const { StateStore } = require('./state-store');
const { resolveRuntimePaths } = require('./runtime-paths');
const { configureNetworkProxy, applyNetworkProxy } = require('./network-proxy');
const { DesktopUpdater } = require('../desktop-updater');
const menuCopy = require('./menu-copy');

const APP_NAME = 'DeepSeek Harness Desktop';
const RELEASE_DOWNLOAD_URL = 'https://github.com/westhack/deepseek-harness-desktop/releases/latest';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/deepseek-harness-desktop/releases/latest';
const LATEST_RELEASE_API_URL_OVERRIDE = process.env.DEEPSEEK_HARNESS_DESKTOP_TEST_RELEASE_API_URL;
const TEST_CURRENT_VERSION = process.env.DEEPSEEK_HARNESS_DESKTOP_TEST_CURRENT_VERSION;
const TEST_ENABLE_UPDATE = process.env.DEEPSEEK_HARNESS_DESKTOP_TEST_ENABLE_UPDATE;
const DEEPSEEK_HARNESS_WINDOW_TITLE = 'DeepSeek Harness';

/**
 * DEEPSEEK HARNESS 主管理器
 * 翻译自 deepseek-harness-desktop src/main/index.ts
 * 负责：controller/updater 初始化、IPC 注册、窗口管理、菜单、更新通知
 */
class DshManager {
  constructor() {
    this.controller = null;
    this.desktopUpdater = null;
    this.dshWindow = null;
    this.dshUpdatePopover = null;
    this.latestSnapshotForWindowTitle = null;
    this.isQuitting = false;
    this.isOpeningPrimary = false;
    this.notifiedVersion = null;
    this.notifiedDesktopVersion = null;
    this.dismissedDshPopoverVersion = null;
    this.dshPopoverSignature = null;
    this.activeLocale = 'zh-CN';
    this.activeLocalePreference = 'system';
    this.initialized = false;
    this.tray = null;
    this.trayTooltip = APP_NAME;
    this.isStoppingForQuit = false;
    this.lastRuntimeStatus = 'idle';
    this.hasHiddenOnLaunch = false;
    this.isClosingDshWindowProgrammatically = false;
  }

  /**
   * 主流程：在 ee-core electronAppReady 后调用
   */
  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    app.setName(APP_NAME);
    if (process.platform === 'darwin') process.title = APP_NAME;

    try {
      // 1. 网络代理探测
      const proxy = await configureNetworkProxy(session.defaultSession);
      await applyNetworkProxy(electronUpdater.autoUpdater.netSession, proxy);
      // DEEPSEEK HARNESS 业务窗口直连，不走代理
      await session.fromPartition('persist:dsh-web').setProxy({ mode: 'direct' });

      // 2. 运行时路径解析
      const resourcesRoot = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'build-resources');
      const runtime = resolveRuntimePaths(resourcesRoot, app.isPackaged);

      // 3. 核心模块实例化
      const store = new StateStore(app.getPath('userData'));
      const versions = new VersionManager(app.getPath('userData'), path.join(resourcesRoot, 'dsh'), runtime, proxy.url);
      const supervisor = new DshSupervisor(runtime.node);
      const currentAppVersion = TEST_CURRENT_VERSION && semver.valid(TEST_CURRENT_VERSION) ? TEST_CURRENT_VERSION : app.getVersion();
      const updateSupported = app.isPackaged || TEST_ENABLE_UPDATE === '1';
      this.controller = new AppController(
        currentAppVersion, store,
        new DshRegistry(net.fetch),
        versions, supervisor, runtime,
        this.normalizeSystemLocale(app.getLocale())
      );

      // 4. 应用更新器（macOS 走 manual，其他走 automatic）
      this.desktopUpdater = new DesktopUpdater(
        electronUpdater.autoUpdater,
        currentAppVersion,
        updateSupported,
        process.platform === 'darwin' ? 'manual' : 'automatic',
        async () => { await shell.openExternal(RELEASE_DOWNLOAD_URL); },
        process.platform === 'darwin' ? () => this.checkLatestManualRelease() : undefined
      );

      // 5. 事件监听
      this.desktopUpdater.on('changed', (snapshot) => {
        this.sendToManager(channels.appUpdateChanged, snapshot);
        if (snapshot.status === 'available') void this.notifyDesktopUpdate(snapshot);
      });
      this.controller.on('snapshot', (snapshot) => this.handleSnapshot(snapshot));
      this.controller.on('progress', (progress) => this.sendToManager(channels.installProgress, progress));

      // 6. 注册 IPC
      this.registerIpc();

      // 7. 初始化 controller
      const initialSnapshot = await this.controller.initialize();
      this.activeLocale = initialSnapshot.locale;
      this.activeLocalePreference = initialSnapshot.localePreference;
      // 记录初始运行状态，避免启动时 DEEPSEEK HARNESS 已在运行而立即隐藏主窗口
      this.lastRuntimeStatus = initialSnapshot.runtimeStatus;
      if (['starting', 'running'].includes(initialSnapshot.runtimeStatus)) {
        this.hasHiddenOnLaunch = true;
      }

      // 8. 菜单与 About 面板
      this.installApplicationMenu();
      this.updateAboutPanel();

      // 9. 刷新版本列表并打开主窗口
      const refreshed = await this.controller.refresh();
      this.latestSnapshotForWindowTitle = refreshed;
      this.notifyDshUpdate(refreshed);
      await this.openPrimaryWindow();

      // 10. 4 秒后检查应用更新
      setTimeout(() => { void this.desktopUpdater?.check(); }, 4_000);

      // 11. 安装系统托盘并拦截主窗口关闭行为（点 x 号隐藏到托盘）
      this.installTrayAndWindowPolicy();

      logger.info('[dsh-manager] initialized successfully');
    } catch (error) {
      logger.error('[dsh-manager] initialization failed:', error instanceof Error ? error.message : error);
      // 初始化失败时确保版本管理器窗口可见
      this.showMainWindow();
    }
  }

  /**
   * 处理 controller 快照变化
   */
  handleSnapshot(snapshot) {
    logger.info('[dsh-manager] handleSnapshot runtimeStatus:', snapshot.runtimeStatus, 'last:', this.lastRuntimeStatus, 'hasHidden:', this.hasHiddenOnLaunch);
    this.latestSnapshotForWindowTitle = snapshot;
    if (snapshot.locale !== this.activeLocale || snapshot.localePreference !== this.activeLocalePreference) {
      this.activeLocale = snapshot.locale;
      this.activeLocalePreference = snapshot.localePreference;
      this.installApplicationMenu();
      this.updateAboutPanel();
      this.refreshTrayMenu();
    }
    this.setDshWindowTitle(snapshot);
    this.showDshUpdatePopover(snapshot);
    this.sendToManager(channels.stateChanged, snapshot);
    this.updateMenuDshUpdateHint(snapshot);
    this.updateTrayTooltip(snapshot);
    // DEEPSEEK HARNESS 进入 running 时隐藏主窗口到托盘（每次运行周期只隐藏一次）
    // hasHiddenOnLaunch 在 DEEPSEEK HARNESS 回到 idle/failed 时重置
    if (snapshot.runtimeStatus === 'running' && !this.hasHiddenOnLaunch) {
      this.hideMainWindowToTray();
      this.hasHiddenOnLaunch = true;
    }
    // DEEPSEEK HARNESS 停止后重置隐藏标记，下次启动再隐藏
    if (['idle', 'failed'].includes(snapshot.runtimeStatus)) {
      this.hasHiddenOnLaunch = false;
    }
    this.lastRuntimeStatus = snapshot.runtimeStatus;
    // DEEPSEEK HARNESS 停止后关闭业务窗口（设置标志绕过 close 拦截）
    if (['idle', 'failed'].includes(snapshot.runtimeStatus) && this.dshWindow && !this.dshWindow.isDestroyed()) {
      this.isClosingDshWindowProgrammatically = true;
      try {
        this.dshWindow.close();
      } finally {
        this.isClosingDshWindowProgrammatically = false;
      }
    }
  }

  /**
   * 隐藏主窗口到托盘（不退出应用）
   */
  hideMainWindowToTray() {
    const win = getMainWindow();
    logger.info('[dsh-manager] hideMainWindowToTray called, win:', !!win, 'visible:', win?.isVisible?.());
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
      this.flashTrayNoticeOnce();
      logger.info('[dsh-manager] main window hidden to tray');
    }
  }

  /**
   * 向版本管理器窗口（ee-core 主窗口）推送消息
   */
  sendToManager(channel, payload) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }

  /**
   * 显示版本管理器窗口（复用 ee-core 主窗口）
   */
  showMainWindow() {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  }

  /**
   * 打开 DEEPSEEK HARNESS 业务窗口，加载官方 DEEPSEEK HARNESS 的本地 URL
   */
  async openDshWindow(rawUrl) {
    const parsedUrl = new URL(rawUrl);
    const allowedOrigin = parsedUrl.origin;
    if (parsedUrl.protocol !== 'http:' || parsedUrl.hostname !== '127.0.0.1' || !parsedUrl.port || parsedUrl.username || parsedUrl.password) {
      throw new Error('拒绝打开未经验证的 DEEPSEEK HARNESS 地址');
    }
    if (this.dshWindow && !this.dshWindow.isDestroyed()) {
      if (!this.dshWindow.isVisible()) this.dshWindow.show();
      this.dshWindow.focus();
      return;
    }
    const window = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 800,
      minHeight: 600,
      title: this.latestSnapshotForWindowTitle ? this.dshWindowTitle(this.latestSnapshotForWindowTitle) : DEEPSEEK_HARNESS_WINDOW_TITLE,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: 'persist:dsh-web'
      }
    });
    this.dshWindow = window;
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== allowedOrigin) {
        event.preventDefault();
        if (isSafeExternalUrl(url)) void shell.openExternal(url);
      }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('did-finish-load', () => {
      if (this.latestSnapshotForWindowTitle) this.setDshWindowTitle(this.latestSnapshotForWindowTitle);
      if (process.env.DEEPSEEK_HARNESS_OPEN_DEVTOOLS === '1') {
        window.webContents.openDevTools({ mode: 'right' });
      }
    });
    window.webContents.on('page-title-updated', (event) => {
      event.preventDefault();
      if (this.latestSnapshotForWindowTitle) this.setDshWindowTitle(this.latestSnapshotForWindowTitle);
      else window.setTitle(DEEPSEEK_HARNESS_WINDOW_TITLE);
    });
    window.on('focus', () => {
      if (this.latestSnapshotForWindowTitle) this.setDshWindowTitle(this.latestSnapshotForWindowTitle);
    });
    window.on('move', () => this.positionDshUpdatePopover());
    window.on('resize', () => this.positionDshUpdatePopover());
    window.on('minimize', () => this.hideDshUpdatePopover());
    window.on('restore', () => {
      if (this.latestSnapshotForWindowTitle) this.showDshUpdatePopover(this.latestSnapshotForWindowTitle);
    });
    // 点 x 号隐藏到托盘而非关闭（DEEPSEEK HARNESS 进程继续运行，托盘可重新打开）
    // 只有应用真正退出（isQuitting）或程序主动关闭时才放行
    window.on('close', (event) => {
      if (this.isQuitting || this.isClosingDshWindowProgrammatically) return;
      event.preventDefault();
      window.hide();
      if (this.dshUpdatePopover && !this.dshUpdatePopover.isDestroyed()) this.dshUpdatePopover.hide();
    });
    window.on('closed', () => {
      if (this.dshUpdatePopover && !this.dshUpdatePopover.isDestroyed()) this.dshUpdatePopover.close();
      this.dshWindow = null;
      this.refreshTrayMenu();
      if (this.controller?.isRuntimeActive()) void this.controller.stop();
    });
    await window.loadURL(rawUrl);
    if (this.latestSnapshotForWindowTitle) {
      this.setDshWindowTitle(this.latestSnapshotForWindowTitle);
      this.showDshUpdatePopover(this.latestSnapshotForWindowTitle);
    }
    // DEEPSEEK HARNESS 业务窗口创建后，刷新托盘菜单使"DeepSeek Harness"项可用
    this.refreshTrayMenu();
  }

  /**
   * 打开主窗口：优先复用运行中的 DSH，否则启动后打开
   */
  async openPrimaryWindow() {
    if (!this.controller || this.isOpeningPrimary) return;
    this.isOpeningPrimary = true;
    try {
      const current = await this.controller.snapshot();
      if (current.runtimeStatus === 'running' && current.runtimeUrl) {
        await this.openDshWindow(current.runtimeUrl);
        return;
      }
      const launched = await this.controller.launch();
      if (!launched.runtimeUrl) throw new Error('官方 DSH 未返回本地地址');
      await this.openDshWindow(launched.runtimeUrl);
    } catch {
      // 启动失败时显示版本管理器
      this.showMainWindow();
    } finally {
      this.isOpeningPrimary = false;
    }
  }

  /**
   * 注册所有 IPC 通道
   * 每个 handler 校验 sender 必须是主窗口（版本管理器）
   */
  registerIpc() {
    const assertManager = (event) => {
      const win = getMainWindow();
      if (!win || event.sender.id !== win.webContents.id) {
        throw new Error('拒绝未知窗口调用');
      }
    };

    ipcMain.handle(channels.snapshot, async (event) => {
      assertManager(event);
      return await this.controller.snapshot();
    });
    ipcMain.handle(channels.refresh, async (event) => {
      assertManager(event);
      return await this.controller.refresh();
    });
    ipcMain.handle(channels.install, async (event, version) => {
      assertManager(event);
      return await this.controller.install(parseExactVersion(version));
    });
    ipcMain.handle(channels.select, async (event, version) => {
      assertManager(event);
      const target = parseExactVersion(version);
      if (this.controller.isRuntimeActive()) await this.controller.stop();
      await this.controller.select(target);
      const snapshot = await this.controller.launch();
      if (!snapshot.runtimeUrl) throw new Error('官方 DSH 未返回本地地址');
      await this.openDshWindow(snapshot.runtimeUrl);
      return snapshot;
    });
    ipcMain.handle(channels.launch, async (event) => {
      assertManager(event);
      const current = await this.controller.snapshot();
      const snapshot = current.runtimeStatus === 'running' && current.runtimeUrl ? current : await this.controller.launch();
      if (!snapshot.runtimeUrl) throw new Error('官方 DSH 未返回本地地址');
      await this.openDshWindow(snapshot.runtimeUrl);
      return snapshot;
    });
    ipcMain.handle(channels.stop, async (event) => {
      assertManager(event);
      return await this.controller.stop();
    });
    ipcMain.handle(channels.dismissUpdate, async (event, version) => {
      assertManager(event);
      return await this.controller.dismissUpdate(parseExactVersion(version));
    });
    ipcMain.handle(channels.openExternal, async (event, raw) => {
      assertManager(event);
      if (typeof raw !== 'string' || !isSafeExternalUrl(raw)) throw new Error('只允许打开 HTTPS 链接');
      await shell.openExternal(raw);
    });
    ipcMain.handle(channels.setLocale, async (event, raw) => {
      assertManager(event);
      return await this.controller.setLocale(parseLocalePreference(raw));
    });
    ipcMain.handle(channels.setRegistry, async (event, raw) => {
      assertManager(event);
      return await this.controller.setRegistry(parseRegistryPreference(raw));
    });
    ipcMain.handle(channels.appUpdateSnapshot, (event) => {
      assertManager(event);
      return this.desktopUpdater?.snapshot();
    });
    ipcMain.handle(channels.appUpdateCheck, async (event) => {
      assertManager(event);
      return await this.desktopUpdater?.check();
    });
    ipcMain.handle(channels.appUpdateDownload, async (event) => {
      assertManager(event);
      return await this.desktopUpdater?.download();
    });
    ipcMain.handle(channels.appUpdateInstall, async (event) => {
      assertManager(event);
      if (!this.desktopUpdater) return;
      if (this.controller.isRuntimeActive()) await this.controller.stop();
      this.desktopUpdater.install();
    });
  }

  /**
   * 检查 GitHub Releases 最新版本（macOS manual 模式）
   */
  async checkLatestManualRelease() {
    const response = await net.fetch(LATEST_RELEASE_API_URL_OVERRIDE ?? LATEST_RELEASE_API_URL, { headers: { accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub Release 查询失败：${response.status}`);
    const release = await response.json();
    if (release.draft === true || release.prerelease === true || typeof release.tag_name !== 'string') return null;
    const version = release.tag_name.replace(/^v/, '');
    if (!semver.valid(version)) throw new Error('GitHub Release 版本号无效');
    return version;
  }

  /**
   * DeepSeek Harness Desktop 自身更新通知
   */
  async notifyDesktopUpdate(snapshot) {
    if (snapshot.status !== 'available' || !snapshot.availableVersion || this.notifiedDesktopVersion === snapshot.availableVersion) return;
    this.notifiedDesktopVersion = snapshot.availableVersion;
    const copy = menuCopy(this.activeLocale);
    const confirm = await dialog.showMessageBox({
      type: 'info',
      title: copy.desktopUpdateTitle(snapshot.availableVersion),
      message: snapshot.delivery === 'manual'
        ? copy.desktopUpdatePromptManual(snapshot.availableVersion)
        : copy.desktopUpdatePromptAuto(snapshot.availableVersion),
      detail: copy.desktopUpdateBody,
      buttons: [copy.promptUpdateNow, copy.promptUpdateLater],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (confirm.response !== 0) return;
    if (snapshot.delivery === 'manual') {
      await shell.openExternal(RELEASE_DOWNLOAD_URL);
      return;
    }
    if (!this.desktopUpdater) return;
    const downloaded = await this.desktopUpdater.download();
    if (downloaded.status !== 'downloaded') return;
    if (this.controller?.isRuntimeActive()) await this.controller.stop();
    this.desktopUpdater.install();
  }

  /**
   * DSH 版本更新通知
   */
  notifyDshUpdate(snapshot) {
    if (!snapshot.latestVersion || !snapshot.selectedVersion || snapshot.dismissedLatest === snapshot.latestVersion) return;
    if (!semver.gt(snapshot.latestVersion, snapshot.selectedVersion) || this.notifiedVersion === snapshot.latestVersion) return;
    this.notifiedVersion = snapshot.latestVersion;
    if (!Notification.isSupported()) return;
    const copy = menuCopy(this.activeLocale);
    const notification = new Notification({
      title: copy.dshUpdateTitle(snapshot.latestVersion),
      body: copy.dshUpdateBody(snapshot.selectedVersion)
    });
    notification.on('click', () => this.showMainWindow());
    notification.show();
  }

  // ===== 窗口标题 =====

  dshWindowTitle(snapshot) {
    const copy = menuCopy(snapshot.locale);
    if (!snapshot.selectedVersion) return DEEPSEEK_HARNESS_WINDOW_TITLE;
    const currentVersion = `v${snapshot.selectedVersion}`;
    if (snapshot.selectedVersion && snapshot.latestVersion && semver.gt(snapshot.latestVersion, snapshot.selectedVersion)) {
      return `${DEEPSEEK_HARNESS_WINDOW_TITLE} · ${currentVersion} · ${copy.dshWindowUpdateTag(snapshot.latestVersion)}`;
    }
    return `${DEEPSEEK_HARNESS_WINDOW_TITLE} · ${currentVersion}`;
  }

  setDshWindowTitle(snapshot) {
    if (!this.dshWindow || this.dshWindow.isDestroyed()) return;
    this.dshWindow.setTitle(this.dshWindowTitle(snapshot));
  }

  hasDshUpdate(snapshot) {
    return !!(snapshot.selectedVersion && snapshot.latestVersion && semver.gt(snapshot.latestVersion, snapshot.selectedVersion));
  }

  updateMenuDshUpdateHint(snapshot) {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;
    const item = menu.getMenuItemById('quick-update-dsh');
    if (!item) return;
    const copy = menuCopy(snapshot.locale);
    if (!this.hasDshUpdate(snapshot)) {
      item.enabled = false;
      item.label = copy.versionManager;
      return;
    }
    item.enabled = true;
    item.label = copy.openDshUpdateManager(snapshot.latestVersion);
  }

  // ===== DSH 更新气泡窗 =====

  positionDshUpdatePopover() {
    if (!this.dshWindow || this.dshWindow.isDestroyed() || !this.dshUpdatePopover || this.dshUpdatePopover.isDestroyed()) return;
    const parent = this.dshWindow.getBounds();
    const [width, height] = this.dshUpdatePopover.getSize();
    this.dshUpdatePopover.setPosition(parent.x + parent.width - width - 18, parent.y + 72);
  }

  hideDshUpdatePopover() {
    if (this.dshUpdatePopover && !this.dshUpdatePopover.isDestroyed()) this.dshUpdatePopover.hide();
  }

  showDshUpdatePopover(snapshot) {
    if (!this.dshWindow || this.dshWindow.isDestroyed() || !this.hasDshUpdate(snapshot) || this.dismissedDshPopoverVersion === snapshot.latestVersion) {
      this.hideDshUpdatePopover();
      return;
    }
    const signature = `${snapshot.locale}:${snapshot.latestVersion}:${snapshot.selectedVersion}`;
    if (this.dshUpdatePopover && !this.dshUpdatePopover.isDestroyed() && this.dshPopoverSignature === signature) {
      this.positionDshUpdatePopover();
      this.dshUpdatePopover.showInactive();
      return;
    }
    if (this.dshUpdatePopover && !this.dshUpdatePopover.isDestroyed()) this.dshUpdatePopover.close();
    const copy = menuCopy(snapshot.locale);
    const title = escapePopoverHtml(copy.dshWindowUpdateTag(snapshot.latestVersion));
    const action = escapePopoverHtml(copy.dshPopoverUpdateAction);
    const window = new BrowserWindow({
      parent: this.dshWindow,
      width: 282,
      height: 76,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      transparent: true,
      hasShadow: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    this.dshUpdatePopover = window;
    this.dshPopoverSignature = signature;
    window.on('closed', () => {
      if (this.dshUpdatePopover === window) {
        this.dshUpdatePopover = null;
        this.dshPopoverSignature = null;
      }
    });
    window.webContents.on('will-navigate', (event, rawUrl) => {
      let actionName = '';
      try { actionName = new URL(rawUrl).hostname; } catch { return; }
      if (!['open-update', 'dismiss-update'].includes(actionName)) return;
      event.preventDefault();
      if (actionName === 'dismiss-update') {
        this.dismissedDshPopoverVersion = snapshot.latestVersion;
        this.hideDshUpdatePopover();
        return;
      }
      this.hideDshUpdatePopover();
      this.showMainWindow();
    });
    window.once('ready-to-show', () => {
      this.positionDshUpdatePopover();
      window.showInactive();
    });
    const html = `<!doctype html><html lang="${snapshot.locale === 'zh-CN' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:8px}.card{box-sizing:border-box;height:60px;border:1px solid #d9dde3;border-radius:10px;background:#fff;box-shadow:0 6px 18px rgba(20,28,38,.12);color:#20242b;padding:0 43px 0 14px;display:flex;align-items:center;gap:10px;position:relative}.dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:#3b82f6}.title{font-size:13px;font-weight:600;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.action{flex:0 0 auto;border-radius:6px;background:#2563eb;color:#fff;padding:5px 9px;font-size:12px;font-weight:650;line-height:16px;text-decoration:none}.action:hover{background:#1d4ed8}.close{position:absolute;right:10px;top:18px;width:18px;height:18px;border-radius:5px;color:#8b949e;text-align:center;line-height:16px;font-size:18px;text-decoration:none}.close:hover{background:#f1f3f5;color:#30363d}</style></head><body><div class="card"><span class="dot"></span><div class="title">${title}</div><a class="action" href="dsh-update://open-update">${action}</a><a class="close" href="dsh-update://dismiss-update" aria-label="Close">×</a></div></body></html>`;
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  // ===== 托盘 + 窗口关闭策略 =====

  /**
   * 安装系统托盘并拦截主窗口关闭：点 x 号时隐藏到托盘而非退出
   * 真正退出通过托盘菜单"退出"或 Cmd+Q 触发（设置 isQuitting）
   */
  installTrayAndWindowPolicy() {
    const win = getMainWindow();
    if (win) {
      win.on('close', (event) => {
        if (this.isQuitting) return;
        event.preventDefault();
        win.hide();
        this.flashTrayNoticeOnce();
      });
    }

    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'ui', 'version-manager.png')
      : path.join(app.getAppPath(), 'public', 'images', 'logo-32.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    if (!trayIcon.isEmpty()) trayIcon.resize({ width: 16, height: 16 });
    if (process.platform === 'darwin' && !trayIcon.isEmpty()) trayIcon.setTemplateImage(true);

    this.tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
    this.tray.setToolTip(menuCopy(this.activeLocale).trayTooltipIdle);
    // 单击托盘图标：优先显示 DSH 业务窗口（若存在），否则显示主窗口
    this.tray.on('click', () => this.showActiveWindow());
    this.refreshTrayMenu();
  }

  /**
   * 显示当前活跃窗口：DSH 业务窗口存在则显示它，否则显示版本管理器主窗口
   */
  showActiveWindow() {
    if (this.dshWindow && !this.dshWindow.isDestroyed()) {
      if (!this.dshWindow.isVisible()) this.dshWindow.show();
      this.dshWindow.focus();
      return;
    }
    this.showMainWindow();
  }

  /**
   * 刷新托盘右键菜单（locale 变化时同步）
   */
  refreshTrayMenu() {
    if (!this.tray) return;
    const copy = menuCopy(this.activeLocale);
    const menu = Menu.buildFromTemplate([
      {
        label: copy.trayDsh,
        enabled: this.dshWindow != null && !this.dshWindow.isDestroyed(),
        click: () => this.showDshWindow()
      },
      { label: copy.trayVersionManager, click: () => this.showMainWindow() },
      { type: 'separator' },
      { label: copy.trayQuit, click: () => this.quitApp() }
    ]);
    this.tray.setContextMenu(menu);
  }

  /**
   * 显示 DSH 业务窗口（用于托盘菜单）
   */
  showDshWindow() {
    if (this.dshWindow && !this.dshWindow.isDestroyed()) {
      if (!this.dshWindow.isVisible()) this.dshWindow.show();
      this.dshWindow.focus();
    }
  }

  /**
   * 更新托盘 tooltip（根据 DSH 运行状态）
   */
  updateTrayTooltip(snapshot) {
    if (!this.tray) return;
    const copy = menuCopy(this.activeLocale);
    this.trayTooltip = snapshot.runtimeStatus === 'running' && snapshot.selectedVersion
      ? copy.trayTooltipRunning(snapshot.selectedVersion)
      : copy.trayTooltipIdle;
    this.tray.setToolTip(this.trayTooltip);
  }

  /**
   * 首次隐藏到托盘时给一次气泡提示（macOS 无气泡则跳过）
   */
  flashTrayNoticeOnce() {
    if (this._trayNoticeShown) return;
    this._trayNoticeShown = true;
    if (process.platform === 'darwin') return; // macOS 关闭按钮语义本就是隐藏，不打扰
    if (!this.tray) return;
    const copy = menuCopy(this.activeLocale);
    this.tray.displayBalloon({ title: APP_NAME, content: copy.windowHiddenNotice });
  }

  /**
   * 真正退出应用：设置标志位后走 beforeQuit 流程
   */
  quitApp() {
    this.isQuitting = true;
    app.quit();
  }

  // ===== 菜单 =====

  installApplicationMenu() {
    const copy = menuCopy(this.activeLocale);
    const menuIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'ui', 'version-manager.png')
      : path.join(app.getAppPath(), 'build', 'menu-version-manager.png');
    const menuIcon = nativeImage.createFromPath(menuIconPath).resize({ width: 16, height: 16 });
    if (process.platform === 'darwin' && !menuIcon.isEmpty()) menuIcon.setTemplateImage(true);

    const openVersions = {
      id: 'version-manager',
      label: copy.versionManager,
      icon: menuIcon.isEmpty() ? undefined : menuIcon,
      accelerator: 'CmdOrCtrl+,',
      enabled: this.controller !== null,
      click: () => this.showMainWindow()
    };
    const quickUpdateInDsh = {
      id: 'quick-update-dsh',
      label: copy.versionManager,
      enabled: false,
      click: () => this.showMainWindow()
    };
    const about = {
      id: 'about-deepseek-harness-desktop',
      label: copy.about,
      click: () => app.showAboutPanel()
    };
    const checkUpdates = {
      id: 'check-for-updates',
      label: copy.checkUpdates,
      enabled: this.desktopUpdater !== null,
      click: () => { this.showMainWindow(); void this.desktopUpdater?.check(); }
    };

    const template = [
      ...(process.platform === 'darwin' ? [{
        label: APP_NAME,
        submenu: [about, { type: 'separator' }, quickUpdateInDsh, openVersions, checkUpdates, this.languageMenu(copy), { type: 'separator' }, { role: 'hide', label: copy.hide }, { role: 'hideOthers', label: copy.hideOthers }, { type: 'separator' }, { role: 'quit', label: copy.quit }]
      }] : [{ label: APP_NAME, submenu: [about, { type: 'separator' }, quickUpdateInDsh, openVersions, checkUpdates, this.languageMenu(copy), { type: 'separator' }, { role: 'quit', label: copy.quit }] }]),
      { label: copy.edit, submenu: [{ role: 'undo', label: copy.undo }, { role: 'redo', label: copy.redo }, { type: 'separator' }, { role: 'cut', label: copy.cut }, { role: 'copy', label: copy.copy }, { role: 'paste', label: copy.paste }, { role: 'selectAll', label: copy.selectAll }] },
      { label: copy.window, submenu: [{ role: 'minimize', label: copy.minimize }, { role: 'zoom', label: copy.zoom }] }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  languageMenu(copy) {
    return {
      label: copy.language,
      submenu: [
        { label: '简体中文', type: 'radio', checked: this.activeLocale === 'zh-CN', click: () => { void this.controller?.setLocale('zh-CN'); } },
        { label: 'English', type: 'radio', checked: this.activeLocale === 'en-US', click: () => { void this.controller?.setLocale('en-US'); } }
      ]
    };
  }

  updateAboutPanel() {
    const copy = menuCopy(this.activeLocale);
    app.setAboutPanelOptions({
      applicationName: APP_NAME,
      applicationVersion: app.getVersion(),
      version: copy.version(app.getVersion()),
      copyright: 'Copyright © 2026 DeepSeek Harness Desktop contributors',
      credits: copy.credits,
      website: 'https://github.com/westhack/deepseek-harness-desktop'
    });
  }

  normalizeSystemLocale(locale) {
    return locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
  }

  /**
   * 应用退出前停止 DSH 进程
   * 由 before-quit 事件调用，isStoppingForQuit 防止重入
   */
  async beforeQuit() {
    if (this.isStoppingForQuit) return;
    this.isStoppingForQuit = true;
    try {
      if (this.controller?.isRuntimeActive()) {
        await this.controller.stop();
      }
    } finally {
      app.quit();
    }
  }
}

function isSafeExternalUrl(raw) {
  try { return new URL(raw).protocol === 'https:'; } catch { return false; }
}

function escapePopoverHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

// 单例
const dshManager = new DshManager();

module.exports = {
  DshManager,
  dshManager
};
