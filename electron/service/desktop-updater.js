'use strict';

const { EventEmitter } = require('node:events');
const semver = require('semver');

/**
 * DeepSeek Harness Desktop 自身更新器
 * 支持两种交付模式：
 *   - automatic（Windows）：electron-updater 内置的 checkForUpdates / downloadUpdate / quitAndInstall
 *   - manual（macOS）：直接打 GitHub API 查询最新 release，下载则 shell.openExternal
 */
class DesktopUpdater extends EventEmitter {
  constructor(updater, currentVersion, supported, delivery = 'automatic', openManualDownload, manualUpdateCheck) {
    super();
    this.updater = updater;
    this.currentVersion = currentVersion;
    this.supported = supported;
    this.delivery = delivery;
    this.openManualDownload = openManualDownload;
    this.manualUpdateCheck = manualUpdateCheck;

    this.state = {
      currentVersion,
      availableVersion: null,
      delivery,
      status: supported ? 'idle' : 'unsupported',
      percent: null,
      message: supported ? null : '开发模式不检查应用更新'
    };

    // 关闭自动下载与自动安装，完全由用户驱动
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;

    updater.on('checking-for-update', () => this.update({ status: 'checking', percent: null, message: null }));
    updater.on('update-available', (info) => this.update({ status: 'available', availableVersion: info.version, percent: null, message: null }));
    updater.on('update-not-available', () => this.update({ status: 'up-to-date', availableVersion: null, percent: null, message: '当前已是最新版' }));
    updater.on('download-progress', (info) => this.update({ status: 'downloading', percent: Math.max(0, Math.min(100, info.percent)), message: null }));
    updater.on('update-downloaded', (info) => this.update({ status: 'downloaded', availableVersion: info.version, percent: 100, message: '更新已下载，重启后安装' }));
    updater.on('error', (error) => this.update({ status: 'error', percent: null, message: readableUpdateError(error) }));
  }

  snapshot() {
    return { ...this.state };
  }

  async check() {
    if (!this.supported) return this.snapshot();
    if (this.state.status === 'downloading' || this.state.status === 'downloaded') return this.snapshot();

    if (this.delivery === 'manual' && this.manualUpdateCheck) {
      const checkManualUpdate = this.manualUpdateCheck;
      await this.run(async () => {
        this.update({ status: 'checking', percent: null, message: null });
        const version = await checkManualUpdate();
        if (version && semver.valid(version) && semver.gt(version, this.state.currentVersion)) {
          this.update({ status: 'available', availableVersion: version, percent: null, message: null });
        } else {
          this.update({ status: 'up-to-date', availableVersion: null, percent: null, message: '当前已是最新版' });
        }
      });
      return this.snapshot();
    }

    await this.run(async () => { await this.updater.checkForUpdates(); });
    return this.snapshot();
  }

  async download() {
    if (!this.supported) return this.snapshot();
    if (this.state.status !== 'available') throw new Error('当前没有可下载的 DeepSeek Harness Desktop 更新');

    if (this.delivery === 'manual') {
      if (!this.openManualDownload) throw new Error('此平台需要从 GitHub Releases 手动下载更新');
      await this.run(this.openManualDownload);
      return this.snapshot();
    }

    await this.run(async () => {
      this.update({ status: 'downloading', percent: 0, message: null });
      await this.updater.downloadUpdate();
    });
    return this.snapshot();
  }

  install() {
    if (this.delivery === 'manual') throw new Error('此平台需要从 GitHub Releases 手动安装更新');
    if (this.state.status !== 'downloaded') throw new Error('更新尚未下载完成');
    this.updater.quitAndInstall(false, true);
  }

  /**
   * 串行化执行：保证 check/download 不会并发
   */
  async run(action) {
    if (this.busy) {
      await this.busy;
    } else {
      this.busy = action().catch((error) => {
        const normalized = error instanceof Error ? error : new Error('应用更新失败');
        this.update({ status: 'error', percent: null, message: readableUpdateError(normalized) });
      }).finally(() => { this.busy = null; });
      await this.busy;
    }
  }

  update(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('changed', this.snapshot());
  }
}

function readableUpdateError(error) {
  if (/404|latest.*release|No published versions/i.test(error.message)) {
    return '尚未发布可供自动更新的正式版本';
  }
  return `检查更新失败：${error.message}`;
}

module.exports = {
  DesktopUpdater
};
