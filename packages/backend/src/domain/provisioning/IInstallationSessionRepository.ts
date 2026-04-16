export interface InstallationSession {
  id: string;
  createdAt: Date;
  isCompleted: boolean;
}

export interface IInstallationSessionRepository {
  createSession(): Promise<InstallationSession>;
  getSession(id: string): Promise<InstallationSession | null>;
  markCompleted(id: string): Promise<void>;
}
