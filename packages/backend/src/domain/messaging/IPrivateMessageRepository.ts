import { PrivateMessage } from './PrivateMessage';

/**
 * 接口名称：IPrivateMessageRepository
 *
 * 函数作用：
 *   私信聚合的仓储接口——定义私信持久化的契约。
 * Purpose:
 *   Repository interface for PrivateMessage aggregates — defines the persistence contract.
 *
 * 中文关键词：
 *   私信，仓储接口
 * English keywords:
 *   private message, repository interface
 */
export interface IPrivateMessageRepository {
  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Retrieves a PrivateMessage by its unique identifier.
   * Keywords: find, by, id, privatemessage, repository
   */
  findById(id: string): Promise<PrivateMessage | null>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Retrieves multiple PrivateMessages by their IDs.
   * Keywords: find, many, ids, privatemessage, repository
   */
  findByIds(ids: string[]): Promise<PrivateMessage[]>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Retrieves all PrivateMessages between two users.
   * Keywords: find, conversation, privatemessage, repository
   */
  findConversation(userId1: string, userId2: string): Promise<PrivateMessage[]>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Persists a PrivateMessage entity to the database.
   * Keywords: save, create, update, privatemessage, repository
   */
  save(message: PrivateMessage): Promise<void>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Persists a partial update to a PrivateMessage (for auto-delete optimization).
   * Keywords: save, direct, partial, privatemessage, repository
   */
  saveDirect(data: {
    id: string;
    isRead?: boolean;
    deletedBy?: string[];
    expiresAt?: Date | null;
    expiresInMs?: number | null;
    expiresStartedAt?: Date | null;
    autoDeleteForSenderAfterRead?: boolean;
  }): Promise<void>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Persists multiple PrivateMessage entities to the database in bulk.
   * Keywords: save, many, bulk, privatemessage, repository
   */
  saveMany(messages: PrivateMessage[]): Promise<void>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Counts the number of messages sent by a specific user to another specific user.
   * Keywords: count, messages, between, privatemessage, repository
   */
  countMessagesBetween(senderId: string, receiverId: string): Promise<number>;

  delete(id: string): Promise<void>;

  /**
   * Callers: [bootstrapMessageCleanup]
   * Callees: []
   * Description: Finds messages whose expiresAt has passed and the receiver hasn't been cleaned yet.
   * Keywords: expired, cleanup, timed, message, repository
   */
  findExpiredForCleanup(): Promise<Array<{ id: string; receiverId: string; deletedBy: string[] }>>;
}
