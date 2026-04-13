import { AuthChallenge } from './AuthChallenge';

/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of AuthChallenge Aggregates.
 * Keywords: authchallenge, repository, interface, contract, domain
 */
export interface IAuthChallengeRepository {
  findById(id: string): Promise<AuthChallenge | null>;
  save(challenge: AuthChallenge): Promise<void>;
  delete(id: string): Promise<void>;
}
