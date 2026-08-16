'use strict';

const { app: electronApp, screen } = require('electron');
const { logger } = require('ee-core/log');
const { getConfig } = require('ee-core/config');
const { getMainWindow } = require('ee-core/electron');
const { dshManager } = require('../service/dsh/manager');

class Lifecycle {
  /**
   * core app have been loaded
   */
  async ready() {
    logger.info('[lifecycle] ready');
  }

  /**
   * electron app ready - 初始化 DEEPSEEK HARNESS 主管理器
   */
  async electronAppReady() {
    logger.info('[lifecycle] electron-app-ready');

    // 双击图标时显示已打开的窗口
    electronApp.on('second-instance', () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });

    // 退出前停止 DEEPSEEK HARNESS 进程
    electronApp.on('before-quit', (event) => {
      // 标记正在退出，让主窗口 close 事件放行（不隐藏到托盘）
      dshManager.isQuitting = true;
      // 已在停止流程中或 DEEPSEEK HARNESS 未运行，放行退出
      if (dshManager.isStoppingForQuit) return;
      if (!dshManager.controller?.isRuntimeActive()) return;
      event.preventDefault();
      void dshManager.beforeQuit();
    });

    // 初始化 DEEPSEEK HARNESS 模块（网络代理、controller、updater、IPC、菜单等）
    void dshManager.initialize();
  }

  /**
   * main window have been loaded
   */
  async windowReady() {
    logger.info('[lifecycle] window-ready');

    const win = getMainWindow();
    if (!win) return;

    // 窗口居中并按屏幕比例缩放
    const mainScreen = screen.getPrimaryDisplay();
    const { width, height } = mainScreen.workAreaSize;
    const windowWidth = Math.min(1040, Math.floor(width * 0.7));
    const windowHeight = Math.min(760, Math.floor(height * 0.8));
    const x = Math.floor((width - windowWidth) / 2);
    const y = Math.floor((height - windowHeight) / 2);
    win.setBounds({ x, y, width: windowWidth, height: windowHeight });

    // 延迟显示，避免白屏
    const { windowsOption } = getConfig();
    if (windowsOption.show === false) {
      win.once('ready-to-show', () => {
        win.show();
        win.focus();
      });
    }
  }

  /**
   * before app close
   */
  async beforeClose() {
    logger.info('[lifecycle] before-close');
  }
}

module.exports = {
  Lifecycle
};
