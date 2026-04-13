import { UserKey } from './UserKey';

/**
 * Callers: [MessagingApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of UserKey Aggregates.
 * Keywords: userkey, repository, interface, contract, domain, messaging
 */
export interface IUserKeyRepository {
  findByUserId(userId: string): Promise<UserKey | null>;
  save(userKey: UserKey): Promise<void>;
}
