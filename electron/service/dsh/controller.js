'use strict';

const { EventEmitter } = require('node:events');
const semver = require('semver');
const { parseExactVersion, parseLocalePreference, resolveLocale, parseRegistryPreference, resolveRegistryUrl, officialPackageName } = require('../../shared/contracts');
const { runProcess } = require('./process-utils');
const { StateStore } = require('./state-store');

/**
 * DEEPSEEK HARNESS 业务编排器
 * 持有所有子模块，聚合状态为 AppSnapshot 对外暴露
 * 每次内部状态变化都 emit('snapshot')，由主进程转发到渲染层
 */
class AppController extends EventEmitter {
  constructor(appVersion, store, registry, versions, supervisor, runtime, systemLocale = 'zh-CN') {
    super();
    this.appVersion = appVersion;
    this.store = store;
    this.registry = registry;
    this.versions = versions;
    this.supervisor = supervisor;
    this.runtime = runtime;
    this.systemLocale = systemLocale;

    this.state = { schemaVersion: 1, selectedVersion: null, dismissedLatest: null, localePreference: 'system', registryPreference: 'official' };
    this.latestVersion = null;
    this.availableVersions = [];
    this.nodeVersion = null;
    this.error = null;
    this.installing = false;

    // DEEPSEEK HARNESS 进程状态变化时立刻重发快照
    this.supervisor.on('status', () => { void this.emitSnapshot(); });
  }

  async initialize() {
    this.state = await this.store.read();
    this.applyRegistryPreference();
    try {
      const result = await runProcess(this.runtime.node, ['--version'], { timeoutMs: 5_000 });
      this.nodeVersion = result.stdout.trim();
    } catch {
      this.error = '内置 Node.js 运行环境不可用';
    }
    await this.ensureSelection();
    return await this.snapshot();
  }

  /**
   * 应用镜像源偏好到 registry 和 version-manager
   */
  applyRegistryPreference() {
    const url = resolveRegistryUrl(this.state.registryPreference);
    this.registry.setRegistryUrl(`${url}${encodeURIComponent(officialPackageName)}`);
    this.versions.setRegistryUrl(url);
  }

  async refresh() {
    try {
      const catalog = await this.registry.catalog();
      this.latestVersion = catalog.latest;
      this.availableVersions = catalog.versions;
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : '检查版本失败';
    }
    await this.ensureSelection();
    return await this.emitSnapshot();
  }

  async install(version) {
    if (this.installing) throw new Error('已有 DEEPSEEK HARNESS 版本正在安装');
    parseExactVersion(version);
    this.installing = true;
    try {
      if (this.availableVersions.length === 0) {
        const catalog = await this.registry.catalog();
        this.latestVersion = catalog.latest;
        this.availableVersions = catalog.versions;
      }
      await this.versions.install(version, this.availableVersions.map((item) => item.version), (progress) => this.emit('progress', progress));
      if (!this.state.selectedVersion) {
        this.state.selectedVersion = version;
        await this.store.write(this.state);
      }
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : '安装失败';
      throw error;
    } finally {
      this.installing = false;
      await this.emitSnapshot();
    }
    return await this.snapshot();
  }

  async select(version) {
    parseExactVersion(version);
    if (this.supervisor.status !== 'idle' && this.supervisor.status !== 'failed') {
      throw new Error('请先停止正在运行的 DEEPSEEK HARNESS');
    }
    await this.versions.resolve(version);
    this.state.selectedVersion = version;
    await this.store.write(this.state);
    this.error = null;
    return await this.emitSnapshot();
  }

  async launch() {
    if (!this.state.selectedVersion) throw new Error('请先安装并选择一个 DEEPSEEK HARNESS 版本');
    try {
      const resolved = await this.versions.resolve(this.state.selectedVersion);
      await this.supervisor.start(resolved);
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : '启动失败';
      throw error;
    } finally {
      await this.emitSnapshot();
    }
    return await this.snapshot();
  }

  async stop() {
    await this.supervisor.stop();
    return await this.emitSnapshot();
  }

  async dismissUpdate(version) {
    parseExactVersion(version);
    this.state.dismissedLatest = version;
    await this.store.write(this.state);
    return await this.emitSnapshot();
  }

  async setLocale(preference) {
    this.state.localePreference = parseLocalePreference(preference);
    await this.store.write(this.state);
    return await this.emitSnapshot();
  }

  async setRegistry(preference) {
    this.state.registryPreference = parseRegistryPreference(preference);
    this.applyRegistryPreference();
    await this.store.write(this.state);
    return await this.emitSnapshot();
  }

  isRuntimeActive() {
    return !['idle', 'failed'].includes(this.supervisor.status);
  }

  getLocalePreference() {
    return this.state.localePreference;
  }

  /**
   * 聚合所有内部状态为 AppSnapshot
   * installedVersions 与 availableVersions 都用 semver.rcompare 倒序排序
   */
  async snapshot() {
    const installedVersions = (await this.versions.list()).sort((a, b) => semver.rcompare(a.version, b.version));
    const availableVersions = [...this.availableVersions].sort((a, b) => semver.rcompare(a.version, b.version));
    return {
      appVersion: this.appVersion,
      locale: resolveLocale(this.state.localePreference, this.systemLocale),
      localePreference: this.state.localePreference,
      registryPreference: this.state.registryPreference,
      nodeVersion: this.nodeVersion,
      latestVersion: this.latestVersion,
      selectedVersion: this.state.selectedVersion,
      dismissedLatest: this.state.dismissedLatest,
      installedVersions,
      availableVersions,
      runtimeStatus: this.supervisor.status,
      runtimeUrl: this.supervisor.url,
      error: this.error
    };
  }

  /**
   * 若 selectedVersion 不在已安装列表中，自动选最新已安装版本
   */
  async ensureSelection() {
    const versions = await this.versions.list();
    if (this.state.selectedVersion && versions.some((item) => item.version === this.state.selectedVersion)) return;
    this.state.selectedVersion = versions.sort((a, b) => semver.rcompare(a.version, b.version))[0]?.version ?? null;
    await this.store.write(this.state);
  }

  async emitSnapshot() {
    const snapshot = await this.snapshot();
    this.emit('snapshot', snapshot);
    return snapshot;
  }
}

module.exports = {
  AppController
};
