'use strict';

const semver = require('semver');
const { channels } = require('./ipc-channels');

const officialPackageName = '@deepseek-ai/dsh';
const bundledDshVersion = '0.1.0-rc.6';

const VERSION_REGEX = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const LOCALE_PREFERENCES = ['system', 'zh-CN', 'en-US'];
const REGISTRY_PREFERENCES = ['official', 'npmmirror'];
const THEME_PREFERENCES = ['system', 'light', 'dark'];

// 插件安装命令：dsh plugin --profile <name> add <ref>
// profile 限定字母数字下划线短横线；ref 不含空白和 shell 元字符
const PLUGIN_PROFILE_REGEX = /^[A-Za-z0-9_-]+$/;
const PLUGIN_REF_REGEX = /^[^\s"'`<>|;&$\\]+$/;
const PLUGIN_COMMAND_REGEX = /^dsh\s+plugin\s+--profile\s+([A-Za-z0-9_-]+)\s+add\s+(\S+)$/;
// 通用 dsh 命令参数：仅允许字母数字 + 路径与版本字符串常见符号，不含 shell 元字符
const DSH_TOKEN_REGEX = /^[A-Za-z0-9_./:#@?&=%+,-]+$/;
const DSH_TOKEN_MAX_LENGTH = 200;
// 通用 dsh 命令（如 dsh plugin list、dsh --version 等）
const DSH_COMMAND_REGEX = /^dsh(\s+\S+){0,32}$/;
// 插件市场源仅允许 https，路径可附加 /plugins.json
const PLUGIN_SOURCE_REGEX = /^https:\/\/[A-Za-z0-9.\-]+(?::\d+)?(?:\/[^\s?#]*)?$/;

/**
 * 校验版本号字符串：1-80 字符、合法字符且通过 semver.valid
 * @param {unknown} value
 * @returns {string}
 */
function parseExactVersion(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80 || !VERSION_REGEX.test(value)) {
    throw new Error('版本号格式无效');
  }
  if (semver.valid(value) === null) {
    throw new Error('版本号不符合 semver 规范');
  }
  return value;
}

/**
 * 安全校验版本号，不抛异常
 * @param {unknown} value
 * @returns {boolean}
 */
function safeParseExactVersion(value) {
  try {
    parseExactVersion(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验语言偏好
 * @param {unknown} value
 * @returns {'system' | 'zh-CN' | 'en-US'}
 */
function parseLocalePreference(value) {
  if (typeof value !== 'string' || !LOCALE_PREFERENCES.includes(value)) {
    throw new Error('语言偏好无效');
  }
  return value;
}

/**
 * 根据偏好与系统语言解析最终语言
 */
function resolveLocale(preference, systemLocale) {
  return preference === 'system' ? systemLocale : preference;
}

/**
 * 校验镜像源偏好
 * @param {unknown} value
 * @returns {'official' | 'npmmirror'}
 */
function parseRegistryPreference(value) {
  if (typeof value !== 'string' || !REGISTRY_PREFERENCES.includes(value)) {
    throw new Error('镜像源偏好无效');
  }
  return value;
}

/**
 * 根据镜像源偏好返回 npm registry URL
 */
function resolveRegistryUrl(preference) {
  if (preference === 'npmmirror') return 'https://registry.npmmirror.com/';
  return 'https://registry.npmjs.org/';
}

/**
 * 校验主题偏好
 * @param {unknown} value
 * @returns {'system' | 'light' | 'dark'}
 */
function parseThemePreference(value) {
  if (typeof value !== 'string' || !THEME_PREFERENCES.includes(value)) {
    throw new Error('主题偏好无效');
  }
  return value;
}

/**
 * 校验插件市场源 URL，归一化为 /plugins.json 端点
 * 仅接受 https；末尾无 /plugins.json 时自动补全
 * @param {unknown} value
 * @returns {string}
 */
function normalizePluginSource(value) {
  if (typeof value !== 'string') throw new Error('插件市场源必须是字符串');
  const trimmed = value.trim();
  if (!PLUGIN_SOURCE_REGEX.test(trimmed)) throw new Error('插件市场源必须是 https 地址');
  let url = trimmed;
  // 去掉末尾斜杠
  if (url.length > 1 && url.endsWith('/')) url = url.slice(0, -1);
  // 未指向 plugins.json 时补全
  if (!/\/plugins\.json$/.test(url)) url = `${url}/plugins.json`;
  return url;
}

/**
 * 校验并解析插件安装命令
 * 接受形如 `dsh plugin --profile web add github:owner/repo#path:/sub` 的字符串
 * 不接受任何 shell 元字符；spawn 时 shell=false，参数按数组传递
 * @param {unknown} value
 * @returns {{ profile: string, ref: string }}
 */
function parsePluginCommand(value) {
  if (typeof value !== 'string') throw new Error('插件安装命令格式无效');
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) throw new Error('插件安装命令长度无效');
  const match = PLUGIN_COMMAND_REGEX.exec(trimmed);
  if (!match) throw new Error('命令需为：dsh plugin --profile <name> add <plugin-ref>');
  const profile = match[1];
  const ref = match[2];
  if (!PLUGIN_PROFILE_REGEX.test(profile)) throw new Error('profile 名称非法');
  if (!PLUGIN_REF_REGEX.test(ref)) throw new Error('插件引用包含非法字符');
  return { profile, ref };
}

/**
 * 通用 dsh 命令解析：仅接受以 dsh 开头的白名单命令
 * 按空白拆分为 argv，逐个 token 校验（禁止 shell 元字符）
 * spawn 时 shell=false 进一步阻断注入
 * @param {unknown} value
 * @returns {string[]}
 */
function parseDshCommand(value) {
  if (typeof value !== 'string') throw new Error('命令格式无效');
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) throw new Error('命令长度无效');
  if (!DSH_COMMAND_REGEX.test(trimmed)) throw new Error('命令必须以 dsh 开头，且不含 shell 元字符');
  const tokens = trimmed.split(/\s+/);
  if (tokens[0] !== 'dsh') throw new Error('命令必须以 dsh 开头');
  if (tokens.length > 33) throw new Error('命令参数过多');
  for (const token of tokens) {
    if (token.length < 1 || token.length > DSH_TOKEN_MAX_LENGTH) {
      throw new Error('命令参数长度超出限制');
    }
    if (!DSH_TOKEN_REGEX.test(token)) {
      throw new Error('命令参数包含非法字符');
    }
  }
  return tokens;
}

module.exports = {
  channels,
  officialPackageName,
  bundledDshVersion,
  parseExactVersion,
  safeParseExactVersion,
  parseLocalePreference,
  resolveLocale,
  parseRegistryPreference,
  resolveRegistryUrl,
  parseThemePreference,
  parsePluginCommand,
  normalizePluginSource,
  parseDshCommand,
  LOCALE_PREFERENCES,
  REGISTRY_PREFERENCES,
  THEME_PREFERENCES
};
