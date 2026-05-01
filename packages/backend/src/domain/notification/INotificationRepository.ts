import { Notification } from './Notification';

/**
 * 接口名称：INotificationRepository
 *
 * 函数作用：
 *   通知聚合的仓储接口。
 * Purpose:
 *   Repository interface for Notification aggregates.
 *
 * 中文关键词：
 *   通知，仓储接口
 * English keywords:
 *   notification, repository interface
 */
export interface INotificationRepository {
  /**
   * Callers: [NotificationApplicationService]
   * Callees: []
   * Description: Retrieves a Notification by its unique identifier.
   * Keywords: find, by, id, notification, repository
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Callers: [NotificationApplicationService]
   * Callees: []
   * Description: Persists a Notification entity to the database.
   * Keywords: save, create, update, notification, repository
   */
  save(notification: Notification): Promise<void>;

  /**
   * Callers: [NotificationApplicationService]
   * Callees: []
   * Description: Removes a Notification from the database.
   * Keywords: delete, remove, notification, repository
   */
  delete(id: string): Promise<void>;
}
