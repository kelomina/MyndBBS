import { randomUUID as uuidv4 } from 'crypto';
import { IInstallationSessionRepository } from '../../domain/provisioning/IInstallationSessionRepository';
import { InstallationSession } from '../../domain/provisioning/InstallationSession';

export class InMemoryInstallationSessionRepository implements IInstallationSessionRepository {
  private sessions: Map<string, InstallationSession> = new Map();

  async createSession(): Promise<InstallationSession> {
    const session = InstallationSession.create({
      id: uuidv4(),
      createdAt: new Date(),
      isCompleted: false
    });
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string): Promise<InstallationSession | null> {
    return this.sessions.get(id) || null;
  }

  async markCompleted(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.markCompleted();
      this.sessions.set(id, session);
    }
  }
}
