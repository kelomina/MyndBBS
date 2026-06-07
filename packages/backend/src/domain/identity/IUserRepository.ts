import { User } from './User';

/**
 * 接口名称：IUserRepository
 *
 * 函数作用：
 *   用户聚合的仓储接口——定义用户持久化的契约。
 * Purpose:
 *   Repository interface for User aggregates — defines the persistence contract.
 *
 * 调用方 / Called by:
 *   - UserApplicationService
 *   - AdminUserManagementApplicationService
 *
 * 中文关键词：
 *   用户，仓储接口，持久化
 * English keywords:
 *   user, repository interface, persistence
 */
export interface IUserRepository {
  /** 按 ID 查找用户 / Finds a user by ID */
  findById(id: string): Promise<User | null>;

  /** 按邮箱查找用户 / Finds a user by email */
  findByEmail(email: string): Promise<User | null>;

  /** 按用户名查找用户 / Finds a user by username */
  findByUsername(username: string): Promise<User | null>;

  /** 持久化用户（创建/更新）/ Persists a user (create/update) */
  save(user: User): Promise<void>;

  /** 按角色 ID 查找所有用户 / Finds all users by role ID */
  findByRoleId(roleId: string): Promise<User[]>;
}
