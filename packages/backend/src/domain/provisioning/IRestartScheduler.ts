/**
 * Callers: [InstallationApplicationService]
 * Callees: []
 * Description: Port interface for scheduling a backend process restart (e.g. after env changes).
 * Keywords: restart, schedule, port, provisioning, backend
 */
export interface IRestartScheduler {
  scheduleRestart(delayMs: number): void;
}

