/**
 * 接口名称：IRestartScheduler
 *
 * 函数作用：
 *   后端进程重启调度器的端口接口。
 * Purpose:
 *   Port interface for scheduling a backend process restart.
 *
 * 中文关键词：
 *   重启，调度，端口接口
 * English keywords:
 *   restart, schedule, port interface
 */
export interface IRestartScheduler {
  scheduleRestart(delayMs: number): void;
}

