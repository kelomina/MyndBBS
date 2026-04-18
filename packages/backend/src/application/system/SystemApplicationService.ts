import { IRouteWhitelistRepository } from '../../domain/system/IRouteWhitelistRepository';
import { RouteWhitelist } from '../../domain/system/RouteWhitelist';
import { IStoragePort } from '../../domain/system/ports/IStoragePort';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';
import { randomUUID as uuidv4 } from 'crypto';

/**
 * Callers: [AdminController, InstallController]
 * Callees: [IRouteWhitelistRepository, IStoragePort, IUnitOfWork]
 * Description: The Application Service for the System Domain. Orchestrates gateway routes and other system settings.
 * Keywords: system, service, application, orchestration, route, whitelist
 */
export class SystemApplicationService {
  constructor(
    private routeWhitelistRepository: IRouteWhitelistRepository,
    private storagePort: IStoragePort,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * Callers: [UploadController]
   * Callees: [IStoragePort.saveFile]
   * Description: Persists an uploaded attachment and returns its public URL.
   * Keywords: upload, attachment, storage, system, application
   */
  public async uploadAttachment(content: Buffer): Promise<string> {
    const filename = `${uuidv4()}.enc`;
    return this.storagePort.saveFile(filename, content);
  }

  /**
   * Callers: [AdminController.addRouteWhitelist]
   * Callees: [RouteWhitelist.create, IRouteWhitelistRepository.save, IUnitOfWork.execute]
   * Description: Adds a new route whitelist entry.
   * Keywords: add, route, whitelist, system
   */
  public async addRouteWhitelist(path: string, isPrefix: boolean, minRole: string | null, description: string | null): Promise<RouteWhitelist> {
    return this.unitOfWork.execute(async () => {
      const route = RouteWhitelist.create({
        id: uuidv4(),
        path,
        isPrefix,
        minRole,
        description,
      });
      await this.routeWhitelistRepository.save(route);
      return route;
    });
  }

  /**
   * Callers: [AdminController.updateRouteWhitelist]
   * Callees: [IRouteWhitelistRepository.findById, RouteWhitelist.update, IRouteWhitelistRepository.save, IUnitOfWork.execute]
   * Description: Updates an existing route whitelist entry.
   * Keywords: update, route, whitelist, system
   */
  public async updateRouteWhitelist(id: string, path: string, isPrefix: boolean, minRole: string | null, description: string | null): Promise<RouteWhitelist> {
    return this.unitOfWork.execute(async () => {
      const route = await this.routeWhitelistRepository.findById(id);
      if (!route) throw new Error('ERR_ROUTE_NOT_FOUND');
      
      route.update(path, isPrefix, minRole, description);
      await this.routeWhitelistRepository.save(route);
      return route;
    });
  }

  /**
   * Callers: [AdminController.deleteRouteWhitelist]
   * Callees: [IRouteWhitelistRepository.findById, IRouteWhitelistRepository.delete, IUnitOfWork.execute]
   * Description: Deletes an existing route whitelist entry.
   * Keywords: delete, route, whitelist, system
   */
  public async deleteRouteWhitelist(id: string): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const route = await this.routeWhitelistRepository.findById(id);
      if (!route) throw new Error('ERR_ROUTE_NOT_FOUND');
      await this.routeWhitelistRepository.delete(id);
    });
  }
}
