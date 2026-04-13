import { PrivateMessage } from './PrivateMessage';

/**
 * Callers: [MessagingApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of PrivateMessage Aggregates.
 * Keywords: privatemessage, repository, interface, contract, domain
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
}
