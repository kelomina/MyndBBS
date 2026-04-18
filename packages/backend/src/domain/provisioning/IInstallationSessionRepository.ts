import { InstallationSession } from './InstallationSession';

export interface IInstallationSessionRepository {
  createSession(): Promise<InstallationSession>;
  getSession(id: string): Promise<InstallationSession | null>;
  markCompleted(id: string): Promise<void>;
}
