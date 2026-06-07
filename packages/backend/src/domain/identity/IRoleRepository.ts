import { Role } from './Role';

/**
 * 接口名称：IRoleRepository
 *
 * 函数作用：
 *   角色聚合的仓储接口。
 * Purpose:
 *   Repository interface for Role aggregates.
 *
 * 中文关键词：
 *   角色，仓储接口
 * English keywords:
 *   role, repository interface
 */
export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  save(role: Role): Promise<void>;
  delete(id: string): Promise<void>;
}
