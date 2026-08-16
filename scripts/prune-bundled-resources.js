'use strict';

const { lstat, readdir, rm } = require('node:fs/promises');
const path = require('node:path');

/**
 * 清理打包内置 DEEPSEEK HARNESS 中非目标平台的预编译 native 产物与 Windows 调试符号。
 * 仅删除无法在目标平台运行的文件，不动官方 DEEPSEEK HARNESS 包及可执行源码。
 * 翻译自 deepseek-harness-desktop/scripts/prune-bundled-resources.ts
 */

const knownNodePtyPrebuild = /^(darwin|win32)-(arm64|x64)$/;

async function measure(target) {
  const info = await lstat(target);
  if (!info.isDirectory()) return { bytes: info.size, files: 1 };

  let bytes = 0;
  let files = 0;
  for (const entry of await readdir(target)) {
    const child = await measure(path.join(target, entry));
    bytes += child.bytes;
    files += child.files;
  }
  return { bytes, files };
}

async function removeDebugSymbols(target) {
  let bytes = 0;
  let files = 0;
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      const removed = await removeDebugSymbols(child);
      bytes += removed.bytes;
      files += removed.files;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdb')) {
      const info = await lstat(child);
      await rm(child);
      bytes += info.size;
      files += 1;
    }
  }
  return { bytes, files };
}

/**
 * @param {string} dshRoot
 * @param {'darwin' | 'win32'} platform
 * @param {'arm64' | 'x64'} arch
 */
async function pruneBundledResources(dshRoot, platform, arch) {
  const desiredPrebuild = `${platform}-${arch}`;
  const prebuildRoot = path.join(dshRoot, 'node_modules', 'node-pty', 'prebuilds');
  const prebuilds = await readdir(prebuildRoot, { withFileTypes: true });

  if (!prebuilds.some((entry) => entry.isDirectory() && entry.name === desiredPrebuild)) {
    throw new Error(`node-pty 缺少目标平台预编译文件: ${desiredPrebuild}`);
  }

  let removedBytes = 0;
  let removedFiles = 0;
  const removedPrebuilds = [];
  for (const entry of prebuilds) {
    if (!entry.isDirectory() || !knownNodePtyPrebuild.test(entry.name) || entry.name === desiredPrebuild) continue;
    const target = path.join(prebuildRoot, entry.name);
    const measured = await measure(target);
    await rm(target, { recursive: true, force: true });
    removedBytes += measured.bytes;
    removedFiles += measured.files;
    removedPrebuilds.push(entry.name);
  }

  const symbols = await removeDebugSymbols(dshRoot);
  removedBytes += symbols.bytes;
  removedFiles += symbols.files;

  return { removedBytes, removedFiles, removedPrebuilds: removedPrebuilds.sort() };
}

module.exports = {
  pruneBundledResources
};
