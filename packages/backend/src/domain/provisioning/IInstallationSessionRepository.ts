import { InstallationSession } from './InstallationSession';

/**
 * 接口名称：IInstallationSessionRepository
 *
 * 函数作用：
 *   安装会话的仓储接口。
 * Purpose:
 *   Repository interface for InstallationSession aggregates.
 *
 * 中文关键词：
 *   安装会话，仓储接口
 * English keywords:
 *   installation session, repository interface
 */
export interface IInstallationSessionRepository {
  createSession(): Promise<InstallationSession>;
  getSession(id: string): Promise<InstallationSession | null>;
  markCompleted(id: string): Promise<void>;
}
