import { randomUUID as uuidv4 } from 'crypto';
import { IInstallationSessionRepository, InstallationSession } from '../../domain/provisioning/IInstallationSessionRepository';

export class InMemoryInstallationSessionRepository implements IInstallationSessionRepository {
  private sessions: Map<string, InstallationSession> = new Map();

  async createSession(): Promise<InstallationSession> {
    const session = { id: uuidv4(), createdAt: new Date(), isCompleted: false };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string): Promise<InstallationSession | null> {
    return this.sessions.get(id) || null;
  }

  async markCompleted(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.isCompleted = true;
      this.sessions.set(id, session);
    }
  }
}
