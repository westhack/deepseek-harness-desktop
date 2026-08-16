'use strict';

const semver = require('semver');
const { channels } = require('./ipc-channels');

const officialPackageName = '@deepseek-ai/dsh';
const bundledDshVersion = '0.1.0-rc.6';

const VERSION_REGEX = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const LOCALE_PREFERENCES = ['system', 'zh-CN', 'en-US'];
const REGISTRY_PREFERENCES = ['official', 'npmmirror'];

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
  LOCALE_PREFERENCES,
  REGISTRY_PREFERENCES
};
