/**
 * 类名称：InMemoryInstallationSessionRepository
 *
 * 函数作用：
 *   内存实现的安装会话仓储，用于安装流程的临时会话管理。
 * Purpose:
 *   In-memory installation session repository for temporary session management during setup.
 *
 * 中文关键词：
 *   内存仓储，安装会话
 * English keywords:
 *   in-memory repository, installation session
 */
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
