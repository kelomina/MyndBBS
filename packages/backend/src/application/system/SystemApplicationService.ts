import { IRouteWhitelistRepository } from '../../domain/system/IRouteWhitelistRepository';
import { RouteWhitelist } from '../../domain/system/RouteWhitelist';
import { randomUUID as uuidv4 } from 'crypto';

/**
 * Callers: [AdminController, InstallController]
 * Callees: [IRouteWhitelistRepository]
 * Description: The Application Service for the System Domain. Orchestrates gateway routes and other system settings.
 * Keywords: system, service, application, orchestration, route, whitelist
 */
export class SystemApplicationService {
  constructor(
    private routeWhitelistRepository: IRouteWhitelistRepository
  ) {}

  public async addRouteWhitelist(path: string, isPrefix: boolean, minRole: string | null, description: string | null): Promise<RouteWhitelist> {
    const route = RouteWhitelist.create({
      id: uuidv4(),
      path,
      isPrefix,
      minRole,
      description,
    });
    await this.routeWhitelistRepository.save(route);
    return route;
  }

  public async updateRouteWhitelist(id: string, path: string, isPrefix: boolean, minRole: string | null, description: string | null): Promise<RouteWhitelist> {
    const route = await this.routeWhitelistRepository.findById(id);
    if (!route) throw new Error('ERR_ROUTE_NOT_FOUND');
    
    route.update(path, isPrefix, minRole, description);
    await this.routeWhitelistRepository.save(route);
    return route;
  }

  public async deleteRouteWhitelist(id: string): Promise<void> {
    const route = await this.routeWhitelistRepository.findById(id);
    if (!route) throw new Error('ERR_ROUTE_NOT_FOUND');
    await this.routeWhitelistRepository.delete(id);
  }
}
