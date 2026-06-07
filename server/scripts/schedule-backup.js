/**
 * 定时备份调度器
 * 
 * 在应用启动时初始化，每天凌晨自动执行数据库备份。
 * 使用 setInterval 而非 node-cron，避免额外依赖。
 * 
 * 用法（在 app.js 中引入）：
 *   require('./scripts/schedule-backup');
 */

const { runBackup } = require('./backup-db');
const { taskLogger } = require('../middleware/requestLogger');

// 调度配置
const BACKUP_HOUR = parseInt(process.env.BACKUP_HOUR) || 3;  // 默认凌晨 3 点（UTC）
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 小时

/**
 * 计算距离下一个备份时间的毫秒数
 */
function msUntilNextBackup() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(BACKUP_HOUR, 0, 0, 0);

  // 如果今天的备份时间已过，推迟到明天
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * 启动定时备份
 */
function startScheduler() {
  const log = taskLogger('backup-scheduler');
  const delay = msUntilNextBackup();
  const nextRun = new Date(Date.now() + delay);

  log.start({
    nextRun: nextRun.toISOString(),
    intervalHours: BACKUP_INTERVAL_MS / 3600000,
    backupHourUTC: BACKUP_HOUR
  });

  // 首次备份：等到下一个计划时间
  setTimeout(() => {
    // 执行备份
    runBackup()
      .then(result => {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'info',
          type: 'task',
          task: 'backup-scheduler',
          action: 'scheduled_backup_done',
          file: result.file,
          sizeKB: result.sizeKB
        }));
      })
      .catch(err => {
        console.error(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'error',
          type: 'task',
          task: 'backup-scheduler',
          action: 'scheduled_backup_failed',
          error: err.message
        }));
      });

    // 之后每 24 小时执行一次
    setInterval(() => {
      runBackup()
        .then(result => {
          console.log(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'info',
            type: 'task',
            task: 'backup-scheduler',
            action: 'scheduled_backup_done',
            file: result.file,
            sizeKB: result.sizeKB
          }));
        })
        .catch(err => {
          console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'error',
            type: 'task',
            task: 'backup-scheduler',
            action: 'scheduled_backup_failed',
            error: err.message
          }));
        });
    }, BACKUP_INTERVAL_MS);

  }, delay);
}

// 生产环境自动启动调度器
if (process.env.NODE_ENV === 'production') {
  // 延迟 10 秒启动，等数据库连接就绪
  setTimeout(startScheduler, 10000);
}

// 手动运行： node server/scripts/schedule-backup.js --once
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--once')) {
    console.log('手动执行一次备份...');
    runBackup()
      .then(r => { console.log('完成:', r); process.exit(0); })
      .catch(e => { console.error('失败:', e.message); process.exit(1); });
  } else {
    console.log('启动定时备份调度器（Ctrl+C 退出）');
    startScheduler();
  }
}

module.exports = { startScheduler };
