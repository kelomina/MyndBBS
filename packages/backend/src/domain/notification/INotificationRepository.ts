import { Notification } from './Notification';

/**
 * Callers: [NotificationApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Notification Aggregates.
 * Keywords: notification, repository, interface, contract, domain
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
