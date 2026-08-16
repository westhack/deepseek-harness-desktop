'use strict';

const path = require('path');
const { getBaseDir } = require('ee-core/ps');

/**
 * 默认配置
 * DeepSeek Harness Desktop：启用 contextIsolation + sandbox + preload bridge
 * 主窗口即版本管理器窗口，加载 frontend 构建产物
 */
module.exports = () => {
  return {
    openDevTools: false,
    singleLock: true,
    windowsOption: {
      title: 'DeepSeek Harness Desktop',
      width: 1040,
      height: 760,
      minWidth: 760,
      minHeight: 560,
      backgroundColor: '#f4f1e8',
      show: false,
      frame: true,
      icon: path.join(getBaseDir(), 'public', 'images', 'logo-32.png'),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(getBaseDir(), 'electron', 'preload', 'bridge.js'),
      },
    },
    logger: {
      level: 'info',
      rotator: 'daily',
      dateFormat: 'yyyy-MM-dd',
      maxSize: '100m',
      redact: [],
      redactCensor: '[Redacted]',
      timestamp: true,
      depthLimit: 5,
      name: 'ee',
      appLogName: 'ee.log',
      coreLogName: 'ee-core.log',
      errorLogName: 'ee-error.log'
    },
    remote: {
      enable: false,
      url: 'http://electron-egg.kaka996.com/'
    },
    socketServer: {
      enable: false,
      port: 7070,
      path: '/socket.io/',
      channel: 'socket-channel'
    },
    httpServer: {
      enable: false,
      https: {
        enable: false,
        key: '/public/ssl/localhost+1.key',
        cert: '/public/ssl/localhost+1.pem'
      },
      host: '127.0.0.1',
      port: 7071,
    },
    mainServer: {
      indexPath: '/public/dist/index.html',
      channelSeparator: '/',
    }
  }
}
