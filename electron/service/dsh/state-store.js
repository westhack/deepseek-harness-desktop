'use strict';

const { mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const writeFileAtomic = require('write-file-atomic');
const { parseLocalePreference, LOCALE_PREFERENCES, REGISTRY_PREFERENCES, THEME_PREFERENCES, normalizePluginSource } = require('../../shared/contracts');

// 默认插件源
const DEFAULT_PLUGIN_SOURCES = [
  {
    id: 'awesome-dsh',
    name: 'Awesome DSH',
    endpoint: 'https://awesome-dsh-plugin.com/plugins.json',
    website: 'https://awesome-dsh-plugin.com',
    isDefault: true,
  },
];

/**
 * 默认备份配置
 */
const DEFAULT_BACKUP_CONFIG = {
  // 本地导出默认 profile
  profile: 'web',
  // WebDAV 配置
  webdav: { url: '', username: '', password: '', path: '/dsh-backups', filename: 'dsh-backup.json' },
  // GitHub Gist 配置
  gist: { token: '', gistId: '', filename: 'dsh-backup.json' },
  // 自动备份：enabled 开关，target: 'local' | 'webdav' | 'gist'，intervalHours 间隔小时，lastRun 上次时间戳
  autoBackup: { enabled: false, target: 'local', intervalHours: 24, lastRun: null },
};

const defaults = {
  schemaVersion: 1,
  selectedVersion: null,
  dismissedLatest: null,
  localePreference: 'system',
  registryPreference: 'official',
  themePreference: 'system',
  pluginSources: DEFAULT_PLUGIN_SOURCES,
  backupConfig: DEFAULT_BACKUP_CONFIG,
};

/**
 * 校验备份配置：保留白名单字段，缺失项回填默认
 * @param {unknown} raw
 * @returns {object}
 */
function validateBackupConfig(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_BACKUP_CONFIG));
  if (!raw || typeof raw !== 'object') return base;
  const r = raw;
  if (typeof r.profile === 'string' && r.profile.trim()) base.profile = r.profile.trim();
  if (r.webdav && typeof r.webdav === 'object') {
    if (typeof r.webdav.url === 'string') base.webdav.url = r.webdav.url.trim();
    if (typeof r.webdav.username === 'string') base.webdav.username = r.webdav.username;
    if (typeof r.webdav.password === 'string') base.webdav.password = r.webdav.password;
    if (typeof r.webdav.path === 'string') base.webdav.path = r.webdav.path.trim() || '/dsh-backups';
    if (typeof r.webdav.filename === 'string') base.webdav.filename = r.webdav.filename.trim() || 'dsh-backup.json';
  }
  if (r.gist && typeof r.gist === 'object') {
    if (typeof r.gist.token === 'string') base.gist.token = r.gist.token.trim();
    if (typeof r.gist.gistId === 'string') base.gist.gistId = r.gist.gistId.trim();
    if (typeof r.gist.filename === 'string') base.gist.filename = r.gist.filename.trim() || 'dsh-backup.json';
  }
  if (r.autoBackup && typeof r.autoBackup === 'object') {
    base.autoBackup.enabled = Boolean(r.autoBackup.enabled);
    if (['local', 'webdav', 'gist'].includes(r.autoBackup.target)) base.autoBackup.target = r.autoBackup.target;
    const h = Number(r.autoBackup.intervalHours);
    if (Number.isFinite(h) && h >= 1 && h <= 720) base.autoBackup.intervalHours = h;
    if (typeof r.autoBackup.lastRun === 'string' || typeof r.autoBackup.lastRun === 'number' || r.autoBackup.lastRun === null) {
      base.autoBackup.lastRun = r.autoBackup.lastRun ?? null;
    }
  }
  return base;
}

/**
 * 原子化状态持久化
 * 使用 write-file-atomic + mode 0o600，断电不损坏、其他用户不可读
 */
class StateStore {
  constructor(userData) {
    this.file = path.join(userData, 'desktop-state.json');
  }

  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      return {
        schemaVersion: 1,
        selectedVersion: typeof parsed.selectedVersion === 'string' ? parsed.selectedVersion : null,
        dismissedLatest: typeof parsed.dismissedLatest === 'string' ? parsed.dismissedLatest : null,
        localePreference: LOCALE_PREFERENCES.includes(parsed.localePreference) ? parsed.localePreference : 'system',
        registryPreference: REGISTRY_PREFERENCES.includes(parsed.registryPreference) ? parsed.registryPreference : 'official',
        themePreference: THEME_PREFERENCES.includes(parsed.themePreference) ? parsed.themePreference : 'system',
        pluginSources: this.validatePluginSources(parsed.pluginSources),
        backupConfig: validateBackupConfig(parsed.backupConfig),
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { ...defaults };
    }
  }

  /**
   * 校验备份配置
   * @param {unknown} raw
   */
  validateBackupConfig(raw) {
    return validateBackupConfig(raw);
  }

  /**
   * 校验插件源列表：确保每条都有合法 id/name/endpoint，至少有一个默认源
   * @param {unknown} raw
   * @returns {Array<{id: string, name: string, endpoint: string, website: string, isDefault: boolean}>}
   */
  validatePluginSources(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PLUGIN_SOURCES;
    const validated = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id;
      let endpoint;
      try { endpoint = normalizePluginSource(item.endpoint); } catch { continue; }
      const website = typeof item.website === 'string' && item.website.trim() ? item.website.trim() : '';
      const isDefault = Boolean(item.isDefault);
      validated.push({ id, name, endpoint, website, isDefault });
    }
    if (validated.length === 0) return DEFAULT_PLUGIN_SOURCES;
    // 确保恰好一个默认源
    if (!validated.some((s) => s.isDefault)) validated[0].isDefault = true;
    if (validated.filter((s) => s.isDefault).length > 1) {
      validated.forEach((s, i) => { s.isDefault = i === 0; });
    }
    return validated;
  }

  async write(state) {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFileAtomic(this.file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  }
}

module.exports = {
  StateStore
};
