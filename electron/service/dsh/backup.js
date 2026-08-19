'use strict';

/**
 * 备份与恢复：导出 profile 插件清单为可读 JSON，合并方式恢复（保留新装插件）
 * 包含校验、回滚、WebDAV/Gist 同步适配器
 * 不引入额外依赖：WebDAV 与 Gist 均使用 Electron net 模块实现
 */

const { net } = require('electron');

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_KIND = 'dsh-plugin-backup';

/**
 * 解析 dsh plugin list 的输出，提取插件清单
 * 兼容 JSON 与 npm-list 树形输出
 * @param {string} raw
 * @param {string} profile
 * @returns {Array<{name: string, version: string, ref: string}>}
 */
function parsePluginListOutput(raw, profile) {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  // 1) JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.plugins) ? parsed.plugins : null);
      if (arr) return arr.map(normalizeItem).filter(Boolean);
    } catch { /* 按文本解析 */ }
  }
  // 2) 树形输出
  const items = [];
  const lines = trimmed.split(/\r?\n/);
  const NODE_RE = /[├└]──\s+(.+)/;
  const PKG_RE = /^(@?[^@\s]+)@([^\s]+)/;
  const SKIP_RE = /^(Legend:|dsh-profile|\s*[│├└─]*\s*$|.*\d+\s+package)/i;
  for (const line of lines) {
    const m = NODE_RE.exec(line);
    if (!m) continue;
    const rest = m[1].trim();
    if (!rest || SKIP_RE.test(rest)) continue;
    const pm = PKG_RE.exec(rest);
    if (pm) {
      const name = pm[1];
      const version = pm[2];
      items.push({ name, version, ref: `${name}@${version}`, profile: profile || '' });
    }
  }
  return items;
}

function normalizeItem(it) {
  if (!it || typeof it !== 'object') return null;
  const name = String(it.name || it.ref || it.id || it.package || it.packageName || '').trim();
  if (!name) return null;
  const version = String(it.version || it.ver || '').trim();
  const ref = String(it.ref || it.installRef || (version ? `${name}@${version}` : name)).trim();
  return { name, version, ref, profile: String(it.profile || '') };
}

/**
 * 校验备份 JSON 结构
 * @param {unknown} raw
 * @returns {{ok: true, backup: ValidBackup} | {ok: false, error: string}}
 */
function validateBackup(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '备份内容不是合法 JSON 对象' };
  const b = raw;
  if (b.kind !== BACKUP_KIND) return { ok: false, error: `kind 字段不匹配，期望 "${BACKUP_KIND}"` };
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion < 1) return { ok: false, error: 'schemaVersion 字段无效' };
  if (typeof b.profile !== 'string' || !b.profile.trim()) return { ok: false, error: 'profile 字段缺失或为空' };
  if (!Array.isArray(b.plugins)) return { ok: false, error: 'plugins 字段不是数组' };
  for (let i = 0; i < b.plugins.length; i++) {
    const p = b.plugins[i];
    if (!p || typeof p !== 'object') return { ok: false, error: `plugins[${i}] 不是对象` };
    const name = String(p.name || '').trim();
    const ref = String(p.ref || '').trim();
    if (!name) return { ok: false, error: `plugins[${i}].name 为空` };
    if (!ref) return { ok: false, error: `plugins[${i}].ref 为空` };
  }
  return { ok: true, backup: b };
}

/**
 * 构造备份对象
 */
function buildBackup({ profile, plugins, dshVersion, appVersion, hostname }) {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    kind: BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    exportedBy: {
      machine: hostname || require('node:os').hostname() || 'unknown',
      dshVersion: dshVersion || null,
      appVersion: appVersion || null,
    },
    profile,
    plugins: plugins.map((p) => ({ name: p.name, version: p.version || '', ref: p.ref || `${p.name}${p.version ? `@${p.version}` : ''}` })),
  };
}

/**
 * 备份管理器：依赖外部注入的 spawnDshCli 与 controller
 */
class BackupManager {
  /**
   * @param {{
   *   controller: object,
   *   spawnDshCli: (resolved: object, args: string[], env: object, send: function, options?: object) => Promise<{exitCode: number|null, stdout: string, stderr: string}>,
   *   appVersion: string,
   * }} ctx
   */
  constructor(ctx) {
    this.controller = ctx.controller;
    this.spawnDshCli = ctx.spawnDshCli;
    this.appVersion = ctx.appVersion || '0.0.0';
  }

  /**
   * 解析当前 dsh 运行时
   * @returns {Promise<{resolved: object, env: object}>}
   */
  async _resolveRuntime() {
    const ctrl = this.controller;
    if (!ctrl) throw new Error('控制器尚未初始化');
    const selected = ctrl.state.selectedVersion;
    if (!selected) throw new Error('请先安装并选择一个 DEEPSEEK HARNESS 版本');
    const resolved = await ctrl.versions.resolve(selected);
    const runtime = ctrl.runtime;
    if (!runtime?.node) throw new Error('内置 Node.js 运行环境不可用');
    const env = ctrl.supervisor.buildChildEnv();
    return { resolved, env };
  }

  /**
   * 导出 profile 的插件清单为 JSON 对象
   * @param {string} profile
   * @param {(level: string, line: string) => void} [send]
   * @returns {Promise<object>} 备份对象
   */
  async exportProfile(profile, send) {
    if (!profile || typeof profile !== 'string') throw new Error('profile 不能为空');
    const { resolved, env } = await this._resolveRuntime();
    const emit = send || (() => {});
    emit('info', `$ dsh plugin --profile ${profile} list`);
    const { exitCode, stdout } = await this.spawnDshCli(resolved, ['plugin', '--profile', profile, 'list'], env, emit, { capture: true });
    if (exitCode !== 0) throw new Error(`查询已安装列表失败（退出码 ${exitCode ?? 'unknown'}）`);
    const plugins = parsePluginListOutput(stdout, profile);
    const backup = buildBackup({
      profile,
      plugins,
      dshVersion: resolved.version || this.controller.state.selectedVersion,
      appVersion: this.appVersion,
    });
    emit('success', `导出完成：${plugins.length} 个插件`);
    return backup;
  }

  /**
   * 合并方式恢复：仅安装备份中存在但当前缺失的插件，保留备份后新装的插件
   * 写入前校验，失败自动回滚（卸载本次新装的插件）
   * @param {object} backup 校验通过的备份对象
   * @param {(level: string, line: string) => void} [send]
   * @returns {Promise<{installed: string[], skipped: string[], failed: Array<{ref: string, error: string}>, rolledback: string[]}>}
   */
  async importProfile(backup, send) {
    const validation = validateBackup(backup);
    if (!validation.ok) throw new Error(`备份校验失败：${validation.error}`);
    const b = validation.backup;
    const profile = b.profile;
    const emit = send || (() => {});
    const { resolved, env } = await this._resolveRuntime();

    // 1) 获取当前已安装列表
    emit('info', `$ dsh plugin --profile ${profile} list`);
    const listResult = await this.spawnDshCli(resolved, ['plugin', '--profile', profile, 'list'], env, emit, { capture: true });
    if (listResult.exitCode !== 0) throw new Error(`查询当前已安装列表失败（退出码 ${listResult.exitCode ?? 'unknown'}）`);
    const currentPlugins = parsePluginListOutput(listResult.stdout, profile);
    const currentNames = new Set(currentPlugins.map((p) => p.name));

    // 2) 计算需要安装的插件（备份中有但当前没有的）
    const toInstall = b.plugins.filter((p) => !currentNames.has(p.name));
    const skipped = b.plugins.filter((p) => currentNames.has(p.name)).map((p) => p.name);
    emit('info', `合并恢复：共 ${b.plugins.length} 个，跳过 ${skipped.length} 个已存在，待安装 ${toInstall.length} 个`);

    const installed = [];
    const failed = [];
    const rolledback = [];

    if (toInstall.length === 0) {
      emit('success', '无需安装，所有插件均已存在');
      return { installed, skipped, failed, rolledback };
    }

    // 3) 逐个安装（合并模式：失败不影响后续，但记录回滚列表）
    for (const plugin of toInstall) {
      try {
        emit('info', `$ dsh plugin --profile ${profile} add ${plugin.ref}`);
        const result = await this.spawnDshCli(resolved, ['plugin', '--profile', profile, 'add', plugin.ref], env, emit, { capture: true });
        if (result.exitCode !== 0) {
          throw new Error(`退出码 ${result.exitCode ?? 'unknown'}${result.stderr ? `：${result.stderr.trim().slice(-200)}` : ''}`);
        }
        installed.push(plugin.name);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failed.push({ ref: plugin.ref, error: msg });
        emit('error', `安装 ${plugin.ref} 失败：${msg}`);
      }
    }

    // 4) 若有失败，回滚本次已安装的插件（合并模式下回滚 = 卸载本次新增的）
    if (failed.length > 0 && installed.length > 0) {
      emit('info', `检测到 ${failed.length} 个失败，开始回滚 ${installed.length} 个本次新装的插件`);
      for (const name of installed) {
        try {
          emit('info', `$ dsh plugin --profile ${profile} remove ${name}`);
          const result = await this.spawnDshCli(resolved, ['plugin', '--profile', profile, 'remove', name], env, emit, { capture: true });
          if (result.exitCode === 0) {
            rolledback.push(name);
          } else {
            emit('error', `回滚 ${name} 失败（退出码 ${result.exitCode ?? 'unknown'}），请手动检查`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          emit('error', `回滚 ${name} 异常：${msg}`);
        }
      }
      emit('error', `恢复未完成：${failed.length} 个失败，已回滚 ${rolledback.length} 个`);
    } else if (installed.length > 0) {
      emit('success', `恢复完成：新装 ${installed.length} 个，跳过 ${skipped.length} 个`);
    }

    return { installed, skipped, failed, rolledback };
  }
}

// ===== WebDAV 同步适配器（使用 Electron net，无额外依赖） =====

/**
 * WebDAV 客户端：PUT 上传、GET 下载、MKCOL 创建目录、PROPFIND 探测
 */
class WebdavClient {
  /**
   * @param {{url: string, username?: string, password?: string}} config
   */
  constructor(config) {
    this.config = config;
  }

  _headers(extra = {}) {
    const headers = { ...extra };
    if (this.config.username) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password || ''}`).toString('base64');
    }
    return headers;
  }

  _url(path) {
    const base = this.config.url.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return base + p;
  }

  /**
   * 测试连接：尝试 PROPFIND 根目录
   */
  async test() {
    const url = this._url('/');
    return await new Promise((resolve, reject) => {
      const req = net.request({ method: 'PROPFIND', url, redirect: 'follow' });
      req.setHeader('Depth', '0');
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); reject(new Error('WebDAV 连接超时（10s）')); } }, 10000);
      req.on('response', (res) => {
        responded = true; clearTimeout(timer);
        const status = res.statusCode || 0;
        // 207 Multi-Status 是 PROPFIND 成功响应；200/204 也算可用
        if (status >= 200 && status < 300 || status === 207) resolve({ ok: true, status });
        else reject(new Error(`WebDAV 返回 HTTP ${status}`));
      });
      req.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timer); reject(new Error(`WebDAV 连接失败：${err.message}`)); } });
      req.end();
    });
  }

  /**
   * 创建目录（如果不存在）
   * @param {string} dirPath
   */
  async ensureDir(dirPath) {
    const url = this._url(dirPath);
    return await new Promise((resolve) => {
      const req = net.request({ method: 'MKCOL', url, redirect: 'follow' });
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); resolve({ ok: false, reason: 'timeout' }); } }, 10000);
      req.on('response', (res) => {
        responded = true; clearTimeout(timer);
        const status = res.statusCode || 0;
        // 201 Created 或 405 Method Not Allowed（目录已存在）都算成功
        res.on('data', () => {});
        res.on('end', () => {
          if (status === 201 || status === 405 || (status >= 200 && status < 300)) resolve({ ok: true, status });
          else resolve({ ok: false, reason: `HTTP ${status}` });
        });
      });
      req.on('error', () => { if (!responded) { responded = true; clearTimeout(timer); resolve({ ok: false, reason: 'network error' }); } });
      req.end();
    });
  }

  /**
   * 上传内容
   * @param {string} path
   * @param {string} content
   */
  async put(path, content) {
    const url = this._url(path);
    const body = Buffer.from(content, 'utf8');
    return await new Promise((resolve, reject) => {
      const req = net.request({ method: 'PUT', url, redirect: 'follow' });
      req.setHeader('Content-Type', 'application/json; charset=utf-8');
      req.setHeader('Content-Length', String(body.length));
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); reject(new Error('WebDAV 上传超时（30s）')); } }, 30000);
      req.on('response', (res) => {
        responded = true; clearTimeout(timer);
        const status = res.statusCode || 0;
        res.on('data', () => {});
        res.on('end', () => {
          if (status >= 200 && status < 300) resolve({ ok: true, status });
          else reject(new Error(`WebDAV 上传失败：HTTP ${status}`));
        });
      });
      req.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timer); reject(new Error(`WebDAV 上传错误：${err.message}`)); } });
      req.write(body);
      req.end();
    });
  }

  /**
   * 下载内容
   * @param {string} path
   * @returns {Promise<string>}
   */
  async get(path) {
    const url = this._url(path);
    return await new Promise((resolve, reject) => {
      const req = net.request({ method: 'GET', url, redirect: 'follow' });
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let body = '';
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); reject(new Error('WebDAV 下载超时（30s）')); } }, 30000);
      req.on('response', (res) => {
        const status = res.statusCode || 0;
        if (status < 200 || status >= 300) {
          responded = true; clearTimeout(timer);
          reject(new Error(`WebDAV 下载失败：HTTP ${status}`));
          return;
        }
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => { if (!responded) { responded = true; clearTimeout(timer); resolve(body); } });
      });
      req.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timer); reject(new Error(`WebDAV 下载错误：${err.message}`)); } });
      req.end();
    });
  }
}

// ===== GitHub Gist 同步适配器 =====

const GIST_API = 'https://api.github.com/gists';
const GIST_USER_AGENT = 'DeepSeek-Harness-Desktop';

/**
 * GitHub Gist 客户端
 */
class GistClient {
  /**
   * @param {{token: string, gistId?: string, filename?: string}} config
   */
  constructor(config) {
    this.config = config;
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': GIST_USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  /**
   * 测试 token 有效性
   */
  async test() {
    return await new Promise((resolve, reject) => {
      const req = net.request({ method: 'GET', url: 'https://api.github.com/user', redirect: 'follow' });
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let body = '';
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); reject(new Error('Gist 测试超时（10s）')); } }, 10000);
      req.on('response', (res) => {
        const status = res.statusCode || 0;
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => {
          if (responded) return;
          responded = true; clearTimeout(timer);
          if (status >= 200 && status < 300) {
            try { const u = JSON.parse(body); resolve({ ok: true, login: u.login }); }
            catch { resolve({ ok: true }); }
          } else {
            reject(new Error(`Gist token 无效：HTTP ${status}`));
          }
        });
      });
      req.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timer); reject(new Error(`Gist 测试失败：${err.message}`)); } });
      req.end();
    });
  }

  /**
   * 上传内容到 Gist（若 gistId 存在则 PATCH 更新，否则 POST 创建）
   * @param {string} content
   * @returns {Promise<{gistId: string, url: string}>}
   */
  async push(content) {
    const filename = this.config.filename || 'dsh-backup.json';
    const payload = JSON.stringify({ description: 'DSH Plugin Backup', public: false, files: { [filename]: { content } } });
    const body = Buffer.from(payload, 'utf8');
    const gistId = this.config.gistId?.trim();
    const method = gistId ? 'PATCH' : 'POST';
    const url = gistId ? `${GIST_API}/${gistId}` : GIST_API;
    return await new Promise((resolve, reject) => {
      const req = net.request({ method, url, redirect: 'follow' });
      req.setHeader('Content-Type', 'application/json; charset=utf-8');
      req.setHeader('Content-Length', String(body.length));
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let resBody = '';
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); reject(new Error('Gist 上传超时（30s）')); } }, 30000);
      req.on('response', (res) => {
        const status = res.statusCode || 0;
        res.on('data', (chunk) => { resBody += chunk.toString(); });
        res.on('end', () => {
          if (responded) return;
          responded = true; clearTimeout(timer);
          if (status >= 200 && status < 300) {
            try {
              const g = JSON.parse(resBody);
              resolve({ gistId: g.id, url: g.html_url || g.url });
            } catch { resolve({ gistId: '', url: '' }); }
          } else {
            reject(new Error(`Gist 上传失败：HTTP ${status}${resBody ? `：${resBody.slice(-300)}` : ''}`));
          }
        });
      });
      req.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timer); reject(new Error(`Gist 上传错误：${err.message}`)); } });
      req.write(body);
      req.end();
    });
  }

  /**
   * 从 Gist 下载内容
   * @returns {Promise<string>}
   */
  async pull() {
    const gistId = this.config.gistId?.trim();
    if (!gistId) throw new Error('未配置 Gist ID');
    const filename = this.config.filename || 'dsh-backup.json';
    const url = `${GIST_API}/${gistId}`;
    return await new Promise((resolve, reject) => {
      const req = net.request({ method: 'GET', url, redirect: 'follow' });
      for (const [k, v] of Object.entries(this._headers())) req.setHeader(k, v);
      let body = '';
      let responded = false;
      const timer = setTimeout(() => { if (!responded) { responded = true; req.abort(); reject(new Error('Gist 下载超时（30s）')); } }, 30000);
      req.on('response', (res) => {
        const status = res.statusCode || 0;
        if (status < 200 || status >= 300) {
          responded = true; clearTimeout(timer);
          reject(new Error(`Gist 下载失败：HTTP ${status}`));
          return;
        }
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => {
          if (responded) return;
          responded = true; clearTimeout(timer);
          try {
            const g = JSON.parse(body);
            const file = g.files?.[filename];
            if (!file) reject(new Error(`Gist 中未找到文件：${filename}`));
            else resolve(file.content || '');
          } catch (error) {
            reject(new Error(`Gist 内容解析失败：${error.message}`));
          }
        });
      });
      req.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timer); reject(new Error(`Gist 下载错误：${err.message}`)); } });
      req.end();
    });
  }
}

module.exports = {
  BACKUP_SCHEMA_VERSION,
  BACKUP_KIND,
  BackupManager,
  WebdavClient,
  GistClient,
  parsePluginListOutput,
  validateBackup,
  buildBackup,
};
