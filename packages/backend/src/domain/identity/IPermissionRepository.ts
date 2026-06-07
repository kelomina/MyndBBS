import { Permission } from './Permission';

/**
 * 接口名称：IPermissionRepository
 *
 * 函数作用：
 *   权限实体的仓储接口。
 * Purpose:
 *   Repository interface for Permission entities.
 *
 * 中文关键词：
 *   权限，仓储接口
 * English keywords:
 *   permission, repository interface
 */
export interface IPermissionRepository {
  findById(id: string): Promise<Permission | null>;
  save(permission: Permission): Promise<void>;
  delete(id: string): Promise<void>;
}
