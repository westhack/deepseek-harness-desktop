'use strict';

const { spawn } = require('node:child_process');
const { mkdir, readFile, readdir, rename, rm, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { officialPackageName, parseExactVersion, safeParseExactVersion } = require('../../shared/contracts');
const { npmProxyEnvironment } = require('./network-proxy');

/**
 * DEEPSEEK HARNESS 版本管理器
 * 负责已安装 DEEPSEEK HARNESS 版本的发现、校验、安装、解析
 * 两类版本来源：
 *   - bundledDir：随应用打包的 DEEPSEEK HARNESS（build-resources/dsh -> process.resourcesPath/dsh）
 *   - versionsDir：用户通过 npm 安装的版本（userData/dsh-versions）
 */
class VersionManager {
  constructor(userData, bundledDir, runtime, proxyUrl = null, registryUrl = 'https://registry.npmjs.org/') {
    this.bundledDir = bundledDir;
    this.runtime = runtime;
    this.proxyUrl = proxyUrl;
    this.registryUrl = registryUrl;
    this.versionsDir = path.join(userData, 'dsh-versions');
  }

  /**
   * 更新 registry URL（切换镜像源时调用）
   */
  setRegistryUrl(url) {
    this.registryUrl = url;
  }

  /**
   * 列出所有已安装版本（bundled + installed），去重
   * @returns {Promise<Array<{ version: string, source: 'bundled' | 'installed' }>>}
   */
  async list() {
    const entries = [];
    for (const [base, source] of [[this.bundledDir, 'bundled'], [this.versionsDir, 'installed']]) {
      let names = [];
      try {
        names = await readdir(base);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      for (const version of names) {
        if (!safeParseExactVersion(version)) continue;
        try {
          await this.resolveAt(path.join(base, version), version, source);
          entries.push({ version, source });
        } catch {
          // 忽略不完整的目录
        }
      }
    }
    return entries.filter((item, index, all) => all.findIndex((other) => other.version === item.version) === index);
  }

  /**
   * 解析指定版本，优先用户安装的，否则回退到 bundled
   * @returns {Promise<{ version: string, root: string, entry: string, source: 'bundled' | 'installed' }>}
   */
  async resolve(version) {
    parseExactVersion(version);
    const installed = path.join(this.versionsDir, version);
    if (existsSync(installed)) return await this.resolveAt(installed, version, 'installed');
    return await this.resolveAt(path.join(this.bundledDir, version), version, 'bundled');
  }

  /**
   * 通过 npm 安装指定版本到 userData
   * 使用 staging 临时目录 + 原子重命名，避免半成品被 list() 当成已安装
   * @param {string} version
   * @param {string[]} availableVersions
   * @param {(value: { version: string, phase: string, message: string }) => void} progress
   */
  async install(version, availableVersions, progress) {
    parseExactVersion(version);
    if (!availableVersions.includes(version)) throw new Error('该版本不在官方 npm 版本目录中');
    await mkdir(this.versionsDir, { recursive: true });
    const destination = path.join(this.versionsDir, version);
    if (existsSync(destination)) {
      await this.resolveAt(destination, version, 'installed');
      return;
    }
    const staging = path.join(this.versionsDir, `.install-${version}-${Date.now()}`);
    await mkdir(staging, { recursive: true });
    try {
      await writeFile(path.join(staging, 'package.json'), `${JSON.stringify({
        name: 'deepseek-harness-desktop-managed-version', version: '0.0.0', private: true,
        dependencies: { [officialPackageName]: version }
      })}\n`);
      progress({ version, phase: 'downloading', message: `正在安装官方 DEEPSEEK HARNESS ${version}` });
      await this.runNpmInstall(staging, (line) => {
        progress({ version, phase: 'downloading', message: `正在安装依赖：${line}` });
      });
      progress({ version, phase: 'validating', message: '正在校验官方包版本和入口' });
      await this.resolveAt(staging, version, 'installed');
      await rename(staging, destination);
      progress({ version, phase: 'complete', message: `DEEPSEEK HARNESS ${version} 已安装` });
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      progress({ version, phase: 'failed', message: error instanceof Error ? error.message : '安装失败' });
      throw error;
    }
  }

  /**
   * 卸载用户安装的指定版本
   * 仅允许卸载 source === 'installed' 的版本，bundled 版本不可卸载
   * 卸载当前选中版本时由调用方负责切换到其他版本
   * @param {string} version
   */
  async uninstall(version) {
    parseExactVersion(version);
    const destination = path.join(this.versionsDir, version);
    if (!existsSync(destination)) {
      throw new Error('该版本未安装');
    }
    // 确认该目录确实是用户安装版本（而非 bundled）
    await this.resolveAt(destination, version, 'installed');
    await rm(destination, { recursive: true, force: true });
  }

  /**
   * 使用内置 node 执行 npm install
   * 强制 shell: false，注入代理环境变量
   * --prefer-online：避免本地缓存陈旧导致 ETARGET
   * 不使用 --legacy-peer-deps：让 npm 7+ 自动安装 peer 依赖（如 cordis-plugin-group）
   * @param {string} prefix
   * @param {(line: string) => void} [onLine] npm 输出每行的回调，用于实时推送进度
   */
  async runNpmInstall(prefix, onLine) {
    await new Promise((resolve, reject) => {
      const child = spawn(this.runtime.node, [
        this.runtime.npmCli,
        'install',
        '--prefix', prefix,
        '--no-audit',
        '--no-fund',
        '--prefer-online',
        `--registry=${this.registryUrl}`,
        '--ignore-scripts=false'
      ], { env: npmProxyEnvironment(this.proxyUrl), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      let stdout = '';
      const processLine = (buffer, callback) => {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) callback(trimmed);
        }
        return buffer;
      };
      let stdoutBuffer = '';
      let stderrBuffer = '';
      child.stdout.setEncoding('utf8').on('data', (chunk) => {
        stdout += chunk;
        if (onLine) stdoutBuffer = processLine(stdoutBuffer + chunk, onLine);
      });
      child.stderr.setEncoding('utf8').on('data', (chunk) => {
        stderr += chunk;
        if (onLine) stderrBuffer = processLine(stderrBuffer + chunk, onLine);
      });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`npm 安装失败（退出码 ${code ?? 'unknown'}）：${stderr.slice(-500)}`)));
    });
  }

  /**
   * 校验指定目录下的 DEEPSEEK HARNESS 包完整性
   * 三重防护：包名 + 版本号 + 入口路径必须在 packageRoot 之内（防路径逃逸）
   */
  async resolveAt(root, version, source) {
    const packageRoot = path.join(root, 'node_modules', '@deepseek-ai', 'dsh');
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    if (manifest.name !== officialPackageName || manifest.version !== version) {
      throw new Error('官方 DEEPSEEK HARNESS 包身份或版本校验失败');
    }
    const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.dsh;
    if (!bin) throw new Error('官方 DEEPSEEK HARNESS 包未提供 dsh CLI 入口');
    const entry = path.resolve(packageRoot, bin);
    if (!entry.startsWith(`${packageRoot}${path.sep}`) || !existsSync(entry)) {
      throw new Error('官方 DEEPSEEK HARNESS CLI 入口无效');
    }
    return { version, root, entry, source };
  }
}

module.exports = {
  VersionManager
};
