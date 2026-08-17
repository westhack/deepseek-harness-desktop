'use strict';

const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const os = require('node:os');
const { logger } = require('ee-core/log');

/**
 * 从输出文本中解析本地回环 URL
 * 只接受 http: + 127.0.0.1 + 有 port + 无 username/password 的地址
 * 这是"不可信任的 DEEPSEEK HARNESS 输出"的清洗器
 * @param {string} output
 * @returns {string | null}
 */
function parseLoopbackUrl(output) {
  const matches = output.match(/https?:\/\/[^\s'"<>]+/g) ?? [];
  for (const candidate of matches) {
    try {
      const url = new URL(candidate.replace(/[),.;]+$/, ''));
      if (url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && !url.username && !url.password) {
        return url.origin;
      }
    } catch {
      // 继续扫描
    }
  }
  return null;
}

/**
 * DEEPSEEK HARNESS 进程监控
 * 用内置 Node 启动官方 DEEPSEEK HARNESS CLI 子进程，解析 stdout/stderr 中的本地 URL
 * 对外暴露状态机：idle -> starting -> running -> stopping -> idle/failed
 */
class DshSupervisor extends EventEmitter {
  constructor(nodePath) {
    super();
    this.nodePath = nodePath;
    this.status = 'idle';
    this.url = null;
    this.child = null;
  }

  /**
   * 构建干净的子进程环境变量
   * Electron 主进程的 process.env 可能包含 NODE_OPTIONS、ELECTRON_* 等变量，
   * 这些变量会干扰内置 Node.js 子进程的 ESM loader，导致 DSH 插件加载失败
   * @returns {Record<string, string>}
   */
  buildChildEnv() {
    const env = { ...process.env };
    // 移除 Electron 特有变量，避免干扰 Node.js 运行时
    delete env.NODE_OPTIONS;
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_NO_ATTACH_NOTIFY;
    delete env.ELECTRON_DISABLE_SECURITY_WARNINGS;
    delete env.ELECTRON_ENABLE_LOGGING;
    // macOS/Linux：确保 PATH 包含常用 bin 目录
    if (process.platform !== 'win32') {
      const paths = ['/usr/local/bin', '/usr/bin', '/bin', '/opt/homebrew/bin'];
      const existing = env.PATH ? env.PATH.split(':') : [];
      for (const p of paths) {
        if (!existing.includes(p)) existing.push(p);
      }
      env.PATH = existing.join(':');
    }
    return env;
  }

  /**
   * 启动 DEEPSEEK HARNESS web 子进程
   * @param {{ version: string, root: string, entry: string, source: string }} dsh
   * @param {number} timeoutMs
   * @returns {Promise<string>} 本地访问 URL
   */
  async start(dsh, timeoutMs = 30_000) {
    if (this.child || this.status === 'starting' || this.status === 'running') {
      throw new Error('DEEPSEEK HARNESS 已经在运行');
    }
    this.setStatus('starting');
    logger.info('[DshSupervisor] starting DEEPSEEK HARNESS:', dsh.version, 'entry:', dsh.entry);

    return await new Promise((resolve, reject) => {
      const child = spawn(this.nodePath, [dsh.entry, 'web', '--port', '0'], {
        cwd: dsh.root,
        env: this.buildChildEnv(),
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      child.stdin.end();
      this.child = child;
      let settled = false;
      let buffer = '';
      const finishWithError = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.child = null;
        this.url = null;
        this.setStatus('failed');
        if (buffer.trim()) logger.error('[DshSupervisor] DEEPSEEK HARNESS output before failure:\n', buffer);
        reject(new Error(message));
      };
      const consume = (chunk) => {
        buffer = `${buffer}${chunk.toString()}`.slice(-8192);
        const url = parseLoopbackUrl(buffer);
        if (!url || settled) return;
        settled = true;
        clearTimeout(timer);
        this.url = url;
        this.setStatus('running');
        resolve(url);
      };
      const timer = setTimeout(() => {
        child.kill();
        finishWithError('官方 DEEPSEEK HARNESS 在规定时间内未返回本地访问地址');
      }, timeoutMs);
      child.stdout.on('data', consume);
      child.stderr.on('data', consume);
      child.once('error', () => finishWithError('无法启动官方 DEEPSEEK HARNESS 进程'));
      child.once('exit', (code) => {
        clearTimeout(timer);
        this.child = null;
        this.url = null;
        if (!settled) {
          const tail = buffer.trim().slice(-1200);
          const detail = tail ? `：${tail}` : '';
          finishWithError(`官方 DEEPSEEK HARNESS 启动失败（退出码 ${code ?? 'unknown'}）${detail}`);
        } else {
          this.status = code === 0 ? 'idle' : 'failed';
          this.emit('status', this.status);
        }
      });
    });
  }

  /**
   * 优雅停止：SIGTERM 5 秒后 SIGKILL
   */
  async stop() {
    const child = this.child;
    if (!child) {
      this.url = null;
      this.setStatus('idle');
      return;
    }
    this.setStatus('stopping');
    await new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(forceTimer);
        resolve();
      };
      const forceTimer = setTimeout(() => {
        child.kill('SIGKILL');
        done();
      }, 5_000);
      child.once('exit', done);
      child.kill('SIGTERM');
    });
    this.child = null;
    this.url = null;
    this.setStatus('idle');
  }

  setStatus(status) {
    this.status = status;
    this.emit('status', status);
  }
}

module.exports = {
  DshSupervisor,
  parseLoopbackUrl
};
