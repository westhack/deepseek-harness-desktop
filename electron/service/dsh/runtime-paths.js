'use strict';

const { existsSync } = require('node:fs');
const path = require('node:path');

/**
 * 解析内置 Node.js 与 npm-cli 的绝对路径
 * 打包模式从 resourcesPath/runtime 读取；开发模式回退到当前 npm 的 node 与 npm-cli
 * @param {string} resourcesPath
 * @param {boolean} isPackaged
 * @returns {{ node: string, npmCli: string }}
 */
function resolveRuntimePaths(resourcesPath, isPackaged) {
  // 开发模式可使用环境变量覆盖
  if (!isPackaged && process.env.DEEPSEEK_HARNESS_DESKTOP_NODE) {
    const npmCli = process.env.DEEPSEEK_HARNESS_DESKTOP_NPM_CLI;
    if (!npmCli) throw new Error('设置 DEEPSEEK_HARNESS_DESKTOP_NODE 时也必须设置 DEEPSEEK HARNESS_DESKTOP_NPM_CLI');
    return { node: process.env.DEEPSEEK_HARNESS_DESKTOP_NODE, npmCli };
  }

  const root = path.join(resourcesPath, 'runtime');
  const node = process.platform === 'win32' ? path.join(root, 'node.exe') : path.join(root, 'bin', 'node');
  const npmCli = process.platform === 'win32'
    ? path.join(root, 'npm', 'bin', 'npm-cli.js')
    : path.join(root, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');

  if (existsSync(node) && existsSync(npmCli)) return { node, npmCli };
  if (isPackaged) throw new Error('应用内置 Node.js 运行环境缺失，请重新安装 DeepSeek Harness Desktop');

  // 开发模式回退到当前进程使用的 node 与 npm
  const localNode = process.env.npm_node_execpath ?? 'node';
  const localNpm = process.env.npm_execpath;
  if (!localNpm) throw new Error('开发模式找不到 npm，请先运行 npm install');
  return { node: localNode, npmCli: localNpm };
}

module.exports = {
  resolveRuntimePaths
};
