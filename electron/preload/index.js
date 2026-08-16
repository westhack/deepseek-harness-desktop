'use strict';

/*************************************************
 ** preload 为预加载模块，在程序启动时加载 **
 *************************************************/

const { logger } = require('ee-core/log');
const { dshManager } = require('../service/dsh/manager');

async function preload() {
  logger.info('[preload] deepseek-harness-desktop loading');
  // DEEPSEEK HARNESS 主管理器初始化在 electronAppReady 中执行（见 lifecycle.js）
  // 这里只做轻量的同步初始化
}

module.exports = {
  preload
};
