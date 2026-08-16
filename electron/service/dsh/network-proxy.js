'use strict';

const { connect } = require('node:net');

const proxyProbeHost = '127.0.0.1';
const proxyProbePort = 7890;
const proxyTarget = 'https://registry.npmjs.org/';
const localBypass = '<local>;localhost;127.0.0.1;[::1]';

/**
 * 四层代理探测：环境变量 -> 系统代理 -> 本地 7890 端口 -> 直连
 * @param {{ setProxy: Function, resolveProxy: Function }} targetSession
 * @param {NodeJS.ProcessEnv} environment
 * @param {() => Promise<boolean>} probeLocalProxy
 * @returns {Promise<{ source: 'environment' | 'system' | 'local' | 'direct', url: string | null }>}
 */
async function configureNetworkProxy(targetSession, environment = process.env, probeLocalProxy = () => isLocalPortOpen(proxyProbeHost, proxyProbePort)) {
  const environmentProxy = proxyFromEnvironment(environment);
  if (environmentProxy) {
    await targetSession.setProxy({ mode: 'fixed_servers', proxyRules: environmentProxy, proxyBypassRules: localBypass });
    return { source: 'environment', url: environmentProxy };
  }

  await targetSession.setProxy({ mode: 'system' });
  const systemProxy = proxyFromElectronRules(await targetSession.resolveProxy(proxyTarget));
  if (systemProxy) return { source: 'system', url: systemProxy };

  if (await probeLocalProxy()) {
    const localProxy = `http://${proxyProbeHost}:${proxyProbePort}`;
    await targetSession.setProxy({ mode: 'fixed_servers', proxyRules: localProxy, proxyBypassRules: localBypass });
    return { source: 'local', url: localProxy };
  }

  return { source: 'direct', url: null };
}

/**
 * 将同一代理解析结果应用到另一个 session（用于 electron-updater 的 net session）
 */
async function applyNetworkProxy(targetSession, resolution) {
  if (resolution.source === 'environment' || resolution.source === 'local') {
    await targetSession.setProxy({ mode: 'fixed_servers', proxyRules: resolution.url ?? undefined, proxyBypassRules: localBypass });
  } else {
    await targetSession.setProxy({ mode: 'system' });
  }
}

/**
 * 把 Electron 的 resolveProxy 规则字符串解析成代理 URL
 * 例如 "PROXY 127.0.0.1:7890; DIRECT" -> "http://127.0.0.1:7890"
 */
function proxyFromElectronRules(rules) {
  for (const candidate of rules.split(';')) {
    const [kind, address] = candidate.trim().split(/\s+/, 2);
    if (!address || kind.toUpperCase() === 'DIRECT') continue;
    const protocolMap = { PROXY: 'http', HTTP: 'http', HTTPS: 'https', SOCKS: 'socks5', SOCKS5: 'socks5', SOCKS4: 'socks4' };
    const protocol = protocolMap[kind.toUpperCase()];
    if (protocol) return normalizeProxyUrl(`${protocol}://${address}`);
  }
  return null;
}

function proxyFromEnvironment(environment) {
  for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
    const value = environment[key]?.trim();
    if (value) {
      const normalized = normalizeProxyUrl(value);
      if (normalized) return normalized;
    }
  }
  return null;
}

function normalizeProxyUrl(raw) {
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:', 'socks:', 'socks4:', 'socks5:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function isLocalPortOpen(host, port) {
  return await new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(200);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * 为 npm install 子进程构造代理环境变量
 */
function npmProxyEnvironment(proxyUrl, environment = process.env) {
  if (!proxyUrl) return environment;
  const noProxy = [environment.NO_PROXY, environment.no_proxy, 'localhost,127.0.0.1,::1'].filter(Boolean).join(',');
  return {
    ...environment,
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    http_proxy: proxyUrl,
    https_proxy: proxyUrl,
    NO_PROXY: noProxy,
    no_proxy: noProxy
  };
}

module.exports = {
  configureNetworkProxy,
  applyNetworkProxy,
  proxyFromElectronRules,
  npmProxyEnvironment
};
