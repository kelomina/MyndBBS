import { IRestartScheduler } from '../../../domain/provisioning/IRestartScheduler';

/**
 * Callers: [registry, InstallationApplicationService]
 * Callees: [setTimeout, process.exit]
 * Description: Restarts the backend by exiting the current Node.js process after a delay.
 * Keywords: restart, scheduler, process, exit, provisioning
 */
export class ProcessExitRestartScheduler implements IRestartScheduler {
  public scheduleRestart(delayMs: number): void {
    setTimeout(() => {
      process.exit(0);
    }, delayMs);
  }
}

