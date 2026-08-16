'use strict';

const { mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const writeFileAtomic = require('write-file-atomic');
const { parseLocalePreference, LOCALE_PREFERENCES, REGISTRY_PREFERENCES } = require('../../shared/contracts');

const defaults = {
  schemaVersion: 1,
  selectedVersion: null,
  dismissedLatest: null,
  localePreference: 'system',
  registryPreference: 'official'
};

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
        registryPreference: REGISTRY_PREFERENCES.includes(parsed.registryPreference) ? parsed.registryPreference : 'official'
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { ...defaults };
    }
  }

  async write(state) {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFileAtomic(this.file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  }
}

module.exports = {
  StateStore
};
