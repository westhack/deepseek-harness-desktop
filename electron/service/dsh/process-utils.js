'use strict';

const { spawn } = require('node:child_process');

/**
 * 通用进程执行工具
 * 强制 shell: false、windowsHide: true，避免命令注入
 * @param {string} executable
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number }} options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
async function runProcess(executable, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('命令执行超时'));
    }, options.timeoutMs ?? 120_000);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`命令执行失败（退出码 ${code ?? 'unknown'}）${stderr ? `：${stderr.slice(-500)}` : ''}`));
    });
  });
}

module.exports = {
  runProcess
};
