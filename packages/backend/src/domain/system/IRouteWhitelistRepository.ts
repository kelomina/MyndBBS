import { RouteWhitelist } from './RouteWhitelist';

/**
 * Callers: [SystemApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of RouteWhitelist Aggregates.
 * Keywords: routewhitelist, repository, interface, contract, domain
 */
export interface IRouteWhitelistRepository {
  findById(id: string): Promise<RouteWhitelist | null>;
  save(route: RouteWhitelist): Promise<void>;
  delete(id: string): Promise<void>;
}
