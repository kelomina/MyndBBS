import { IRouteWhitelistRepository } from '../../domain/system/IRouteWhitelistRepository';
import { RouteWhitelist } from '../../domain/system/RouteWhitelist';
import { IStoragePort } from '../../domain/system/ports/IStoragePort';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';
import { randomUUID as uuidv4 } from 'crypto';

/**
 * 类名称：SystemApplicationService
 *
 * 函数作用：
 *   系统域应用服务——编排路由白名单管理、文件上传等系统级功能。
 * Purpose:
 *   System domain application service — orchestrates route whitelist management, file uploads, and other system-level features.
 *
 * 调用方 / Called by:
 *   - adminController
 *   - uploadController
 *
 * 中文关键词：
 *   系统，应用服务，路由白名单，上传
 * English keywords:
 *   system, application service, route whitelist, upload
 */
export class SystemApplicationService {
  /**
   * 函数名称：constructor
   *
   * 函数作用：
   *   通过依赖注入初始化系统服务。
   * Purpose:
   *   Initializes the system service with dependency injection.
   */
  constructor(
    private routeWhitelistRepository: IRouteWhitelistRepository,
    private storagePort: IStoragePort,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * 函数名称：uploadAttachment
   *
   * 函数作用：
   *   持久化上传的附件并返回其公开 URL。
   * Purpose:
   *   Persists an uploaded attachment and returns its public URL.
   *
   * 调用方 / Called by:
   *   uploadController.handleFileUpload
   *
   * 被调用方 / Calls:
   *   - storagePort.saveFile
   *
   * 参数说明 / Parameters:
   *   - content: Buffer, 文件内容缓冲区
   *
   * 返回值说明 / Returns:
   *   string 文件公开 URL
   *
   * 中文关键词：
   *   上传，附件，存储
   * English keywords:
   *   upload, attachment, storage
   */
  public async uploadAttachment(content: Buffer): Promise<string> {
    const filename = `${uuidv4()}.enc`;
    return this.storagePort.saveFile(filename, content);
  }

  /**
   * 函数名称：addRouteWhitelist
   *
   * 函数作用：
   *   添加新的路由白名单条目。
   * Purpose:
   *   Adds a new route whitelist entry.
   *
   * 调用方 / Called by:
   *   adminController.addRouteWhitelist
   *
   * 被调用方 / Calls:
   *   - RouteWhitelist.create
   *   - routeWhitelistRepository.save
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   路由白名单，添加
   * English keywords:
   *   route whitelist, add
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
