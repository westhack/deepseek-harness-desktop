'use strict';

const { officialPackageName, safeParseExactVersion } = require('../../shared/contracts');

/**
 * npm 版本目录查询
 * 构造时注入 fetcher（主进程传入 Electron 的 net.fetch 以走系统代理）
 */
class DshRegistry {
  constructor(fetcher = fetch, registryUrl = `https://registry.npmjs.org/${encodeURIComponent(officialPackageName)}`) {
    this.fetcher = fetcher;
    this.registryUrl = registryUrl;
  }

  /**
   * 更新 registry URL（切换镜像源时调用）
   */
  setRegistryUrl(url) {
    this.registryUrl = url;
  }

  /**
   * 查询官方 DEEPSEEK HARNESS 的所有版本与 latest 标签
   * @returns {Promise<{ latest: string, versions: Array<{ version: string, publishedAt: string | null }> }>}
   */
  async catalog() {
    const response = await this.fetcher(this.registryUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`无法查询官方 DEEPSEEK HARNESS 版本（HTTP ${response.status}）`);
    const data = await response.json();
    const versionNames = Object.keys(data.versions ?? {}).filter((value) => safeParseExactVersion(value));
    const latest = data['dist-tags']?.latest;
    if (!latest || !versionNames.includes(latest)) throw new Error('npm registry 未返回有效的 latest 版本');
    const versions = versionNames.map((version) => ({
      version,
      publishedAt: data.time?.[version] ?? null
    }));
    return { latest, versions };
  }
}

module.exports = {
  DshRegistry
};
