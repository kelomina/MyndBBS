import { Session } from './Session';

/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Session Aggregates.
 * Keywords: session, repository, interface, contract, domain
 */
export interface ISessionRepository {
  findById(id: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
  deleteManyByUserId(userId: string): Promise<void>;
  findByUserId(userId: string): Promise<Session[]>;
}
