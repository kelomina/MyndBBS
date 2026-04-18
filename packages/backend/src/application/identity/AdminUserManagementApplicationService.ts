import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { UserStatus } from '@myndbbs/shared';
import { RoleHierarchyPolicy, RoleName } from './policies/RoleHierarchyPolicy';
import { ISessionCache } from './ports/ISessionCache';
import { AuditApplicationService } from '../system/AuditApplicationService';

type OperatorContext = { userId: string; role: RoleName };

export class AdminUserManagementApplicationService {
  constructor(
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository,
    private passkeyRepository: IPasskeyRepository,
    private sessionRepository: ISessionRepository,
    private sessionCache: ISessionCache,
    private roleHierarchyPolicy: RoleHierarchyPolicy,
    private auditApplicationService: AuditApplicationService
  ) {}

  /**
   * 更改用户等级并记录审计日志
   * @param operator 执行操作的用户信息
   * @param targetUserId 目标用户 ID
   * @param level 新等级
   * @throws {Error} 当目标用户不存在或未设置通行密钥但需要晋升时抛出错误
   */
  public async changeUserLevel(operator: OperatorContext, targetUserId: string, level: number): Promise<void> {
    if (level < 1 || level > 6) {
      throw new Error('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
    }

    const user = await this.userRepository.findById(targetUserId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    if (level > 1) {
      const passkeys = await this.passkeyRepository.findByUserId(targetUserId);
      if (passkeys.length === 0) throw new Error('ERR_CANNOT_PROMOTE_WITHOUT_PASSKEY');
    }

    user.changeLevel(level);
    await this.userRepository.save(user);
    await this.auditApplicationService.logAudit(operator.userId, 'UPDATE_USER_LEVEL', `User:${targetUserId} to Level ${level}`);
  }

  /**
   * 更改用户状态并记录审计日志
   * @param operator 执行操作的用户信息
   * @param targetUserId 目标用户 ID
   * @param status 新状态
   * @throws {Error} 当目标用户不存在或权限不足时抛出错误
   */
  public async changeUserStatus(operator: OperatorContext, targetUserId: string, status: UserStatus): Promise<void> {
    if (!([UserStatus.ACTIVE, UserStatus.BANNED, UserStatus.PENDING, UserStatus.INACTIVE] as UserStatus[]).includes(status)) {
      throw new Error('ERR_INVALID_STATUS');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('ERR_USER_NOT_FOUND');

    const operatorRole = operator.role;
    const targetRole = (await this.roleRepository.findById(target.roleId || ''))?.name || 'USER';
    this.roleHierarchyPolicy.assertRoleName(targetRole);

    if (this.roleHierarchyPolicy.isAtLeast(targetRole, operatorRole) && operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE');
    }

    target.changeStatus(status);
    await this.userRepository.save(target);
    await this.auditApplicationService.logAudit(operator.userId, 'UPDATE_USER_STATUS', `User:${targetUserId} to ${status}`);

    if (status === UserStatus.BANNED) {
      const sessions = await this.sessionRepository.findByUserId(targetUserId);
      for (const s of sessions) {
        await this.sessionCache.revokeSession(s.id);
      }
      await this.sessionRepository.deleteManyByUserId(targetUserId);
    }
  }

  /**
   * 更改用户角色并记录审计日志
   * @param operator 执行操作的用户信息
   * @param targetUserId 目标用户 ID
   * @param newRoleName 新角色
   * @throws {Error} 当目标用户不存在、角色不存在或权限不足时抛出错误
   */
  public async changeUserRole(operator: OperatorContext, targetUserId: string, newRoleName: RoleName): Promise<void> {
    if (!['USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN'].includes(newRoleName)) {
      throw new Error('ERR_INVALID_ROLE');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('ERR_USER_NOT_FOUND');

    const newRole = await this.roleRepository.findByName(newRoleName);
    if (!newRole) throw new Error('ERR_ROLE_NOT_FOUND_IN_DATABASE');

    const currentRoleName = (await this.roleRepository.findById(target.roleId || ''))?.name || 'USER';
    this.roleHierarchyPolicy.assertRoleName(currentRoleName);

    if (this.roleHierarchyPolicy.isAtLeast(currentRoleName, operator.role) && operator.role !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE');
    }

    if (this.roleHierarchyPolicy.compare(newRoleName, operator.role) > 0 && operator.role !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_CANNOT_GRANT_A_ROLE_HIGHER_THAN_YOUR_OWN');
    }

    target.changeRole(newRole.id);
    await this.userRepository.save(target);
    await this.auditApplicationService.logAudit(operator.userId, 'UPDATE_USER_ROLE', `User:${targetUserId} to ${newRoleName}`);

    // Auto-disable root if another user gets SUPER_ADMIN role
    if (newRoleName === 'SUPER_ADMIN' && target.username !== 'root') {
      const rootUser = await this.userRepository.findByUsername('root');
      if (rootUser && rootUser.status !== UserStatus.BANNED) {
        await this.changeUserStatus({ userId: 'system', role: 'SUPER_ADMIN' }, rootUser.id, UserStatus.BANNED);
      }
    }

    const currentVsNew = this.roleHierarchyPolicy.compare(newRoleName, currentRoleName);
    const sessions = await this.sessionRepository.findByUserId(targetUserId);

    if (currentVsNew < 0) {
      for (const s of sessions) {
        await this.sessionCache.revokeSession(s.id);
      }
      await this.sessionRepository.deleteManyByUserId(targetUserId);
    }

    if (currentVsNew > 0) {
      for (const s of sessions) {
        await this.sessionCache.markSessionRequiresRefresh(s.id, 7 * 24 * 60 * 60);
      }
    }
  }

  /**
   * 更改用户角色和等级（在一个操作中）
   * @param operator 执行操作的用户信息
   * @param targetUserId 目标用户 ID
   * @param options 包含要更新的 role 和 level 的选项
   */
  public async changeUserRoleAndLevel(
    operator: OperatorContext,
    targetUserId: string,
    options: { role?: RoleName; level?: number }
  ): Promise<void> {
    if (options.level !== undefined) {
      await this.changeUserLevel(operator, targetUserId, options.level);
    }
    if (options.role) {
      await this.changeUserRole(operator, targetUserId, options.role);
    }
  }
}
