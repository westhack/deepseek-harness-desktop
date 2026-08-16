'use strict';

/**
 * 准备打包运行资源：
 *   1. 下载并校验官方 Node.js 运行时到 build-resources/runtime
 *   2. 使用内置 Node 通过 npm 安装 @deepseek-ai/dsh 到 build-resources/dsh/<version>
 *   3. 调用 pruneBundledResources 清理非目标平台的预编译产物与 Windows 调试符号
 *
 * 翻译自 deepseek-harness-desktop/scripts/prepare-resources.ts
 * 用法：
 *   node scripts/prepare-resources.js --platform=darwin --arch=arm64
 *   node scripts/prepare-resources.js --platform=win32 --arch=x64
 */

const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { mkdir, readFile, readdir, rename, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');

const { pruneBundledResources } = require('./prune-bundled-resources');

const nodeVersion = '24.18.1';
const dshVersion = '0.1.0-rc.6';
const root = path.resolve(__dirname, '..');

function argument(name, fallback) {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
}

async function download(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`Downloading ${path.basename(url)} (attempt ${attempt}/3)`);
      const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
      if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function run(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${executable} 退出码 ${code}`))));
  });
}

async function main() {
  const platform = argument('platform', process.platform);
  const arch = argument('arch', process.arch);
  if (!['darwin', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch)) {
    throw new Error('仅支持 darwin arm64/x64 与 win32 x64 资源');
  }
  if (platform === 'win32' && arch !== 'x64') throw new Error('首版 Windows 仅支持 x64');
  if (platform !== process.platform) throw new Error('请在目标操作系统的 CI runner 上准备运行资源');

  const nodePlatform = platform === 'win32' ? 'win' : 'darwin';
  const extension = platform === 'win32' ? 'zip' : 'tar.gz';
  const archiveName = `node-v${nodeVersion}-${nodePlatform}-${arch}.${extension}`;
  const baseUrl = `https://nodejs.org/dist/v${nodeVersion}`;
  const resourceRoot = path.join(root, 'build-resources');
  const target = path.join(resourceRoot, 'runtime');
  const temporary = path.join(resourceRoot, `.prepare-${platform}-${arch}-${process.pid}`);

  const node = platform === 'win32' ? path.join(target, 'node.exe') : path.join(target, 'bin', 'node');
  const npmCli = platform === 'win32'
    ? path.join(target, 'npm', 'bin', 'npm-cli.js')
    : path.join(target, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');

  let reusable = false;
  try {
    const marker = JSON.parse(await readFile(path.join(target, 'deepseek-harness-desktop-runtime.json'), 'utf8'));
    reusable = marker.nodeVersion === nodeVersion
      && marker.platform === platform
      && marker.arch === arch
      && existsSync(node)
      && existsSync(npmCli);
  } catch {
    /* Prepare the runtime below. */
  }

  if (!reusable) {
    await rm(temporary, { recursive: true, force: true });
    await mkdir(temporary, { recursive: true });
    const archive = await download(`${baseUrl}/${archiveName}`);
    const sums = (await download(`${baseUrl}/SHASUMS256.txt`)).toString('utf8');
    const expected = sums.split('\n').find((line) => line.endsWith(`  ${archiveName}`))?.split(/\s+/)[0];
    const actual = createHash('sha256').update(archive).digest('hex');
    if (!expected || expected !== actual) throw new Error('Node.js 官方发行包 SHA-256 校验失败');
    const archivePath = path.join(temporary, archiveName);
    await writeFile(archivePath, archive);
    const extractDir = path.join(temporary, 'extract');
    await mkdir(extractDir);
    if (platform === 'win32') {
      const command = `Expand-Archive -LiteralPath '${archivePath.replaceAll("'", "''")}' -DestinationPath '${extractDir.replaceAll("'", "''")}' -Force`;
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
    } else {
      await run('tar', ['-xzf', archivePath, '-C', extractDir]);
    }
    const extractedName = (await readdir(extractDir))[0];
    if (!extractedName) throw new Error('Node.js 发行包为空');
    await rm(target, { recursive: true, force: true });
    await mkdir(path.dirname(target), { recursive: true });
    await rename(path.join(extractDir, extractedName), target);
    if (platform === 'win32') {
      // Keep npm outside a top-level node_modules directory so electron-builder
      // always copies it as an application resource on Windows.
      await rename(path.join(target, 'node_modules', 'npm'), path.join(target, 'npm'));
    }
    await writeFile(path.join(target, 'deepseek-harness-desktop-runtime.json'), `${JSON.stringify({ nodeVersion, platform, arch })}\n`);
  } else {
    console.log(`Reusing verified Node.js v${nodeVersion} runtime for ${platform}-${arch}`);
  }

  const dshRoot = path.join(resourceRoot, 'dsh', dshVersion);
  await rm(dshRoot, { recursive: true, force: true });
  await mkdir(dshRoot, { recursive: true });
  await writeFile(path.join(dshRoot, 'package.json'), `${JSON.stringify({
    name: 'deepseek-harness-desktop-bundled-dsh', version: '0.0.0', private: true,
    dependencies: { '@deepseek-ai/dsh': dshVersion }
  })}\n`);
  await run(node, [npmCli, 'install', '--prefix', dshRoot, '--no-audit', '--no-fund', '--prefer-online', '--legacy-peer-deps', '--registry=https://registry.npmjs.org/']);
  const manifest = JSON.parse(await readFile(path.join(dshRoot, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8'));
  if (manifest.name !== '@deepseek-ai/dsh' || manifest.version !== dshVersion) throw new Error('预装官方 DEEPSEEK HARNESS 校验失败');
  const pruned = await pruneBundledResources(dshRoot, platform, arch);
  console.log(`Pruned ${pruned.removedFiles} non-target/debug files (${(pruned.removedBytes / 1024 / 1024).toFixed(1)} MiB): ${pruned.removedPrebuilds.join(', ') || 'debug symbols only'}`);
  await rm(temporary, { recursive: true, force: true });
  console.log(`Prepared Node.js v${nodeVersion} and @deepseek-ai/dsh@${dshVersion} for ${platform}-${arch}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
