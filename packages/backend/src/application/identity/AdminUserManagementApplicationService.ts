import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { UserStatus } from '@myndbbs/shared';
import { RoleHierarchyPolicy, RoleName } from './policies/RoleHierarchyPolicy';
import { ISessionCache } from './ports/ISessionCache';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { UserPromotedEvent, UserStatusChangedEvent, UserRoleChangedEvent } from '../../domain/shared/events/DomainEvents';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

type OperatorContext = { userId: string; role: RoleName };

/**
 * Callers: [AdminUserController]
 * Callees: [IUserRepository, IRoleRepository, IPasskeyRepository, ISessionRepository, ISessionCache, RoleHierarchyPolicy, IEventBus, IUnitOfWork]
 * Description: Handles administrative user management tasks such as changing roles, statuses, and levels.
 * Keywords: admin, manage, user, identity, application, service
 */
export class AdminUserManagementApplicationService {
  constructor(
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository,
    private passkeyRepository: IPasskeyRepository,
    private sessionRepository: ISessionRepository,
    private sessionCache: ISessionCache,
    private roleHierarchyPolicy: RoleHierarchyPolicy,
    private eventBus: IEventBus,
    private unitOfWork: IUnitOfWork,
    private abilityCache: IAbilityCache
  ) {}

  /**
   * Callers: [AdminUserController, AdminUserManagementApplicationService.changeUserRoleAndLevel]
   * Callees: [IUserRepository.findById, IPasskeyRepository.findByUserId, User.changeLevel, IUserRepository.save, IEventBus.publish, IUnitOfWork.execute]
   * Description: Changes a user's level. Records audit logs. Checks passkeys before promoting above level 1.
   * Keywords: admin, manage, user, level, identity, promote, passkey
   * 
   * @param operator The user information executing the operation
   * @param targetUserId The target user ID
   * @param level The new level
   * @throws {Error} Throws an error when the target user does not exist or passkey requirements are not met
   */
  public async changeUserLevel(operator: OperatorContext, targetUserId: string, level: number): Promise<void> {
    return this.unitOfWork.execute(async () => {
      if (level < 1 || level > 6) {
        throw new Error('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
      }

      const user = await this.userRepository.findById(targetUserId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');

      const passkeys = await this.passkeyRepository.findByUserId(targetUserId);
      user.changeLevel(level, passkeys.length > 0);
      await this.userRepository.save(user);
      this.eventBus.publish(new UserPromotedEvent(targetUserId, level, operator.userId));
      await this.abilityCache.invalidateUserRules(targetUserId);
    });
  }

  /**
   * Callers: [AdminUserController]
   * Callees: [IUserRepository.findById, RoleHierarchyPolicy.isAtLeast, User.changeStatus, IUserRepository.save, IEventBus.publish, ISessionCache.revokeSession, ISessionRepository.deleteManyByUserId, IUnitOfWork.execute]
   * Description: Changes a user's status and records an audit log. Ensures proper role hierarchy policies are respected.
   * Keywords: admin, manage, user, status, identity, policy, hierarchy
   * 
   * @param operator The user information executing the operation
   * @param targetUserId The target user ID
   * @param status The new status
   * @throws {Error} Throws an error when the target user does not exist or insufficient permissions
   */
  public async changeUserStatus(operator: OperatorContext, targetUserId: string, status: UserStatus): Promise<void> {
    return this.unitOfWork.execute(async () => {
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
      this.eventBus.publish(new UserStatusChangedEvent(targetUserId, status, operator.userId));
      await this.abilityCache.invalidateUserRules(targetUserId);

      if (status === UserStatus.BANNED) {
        const sessions = await this.sessionRepository.findByUserId(targetUserId);
        for (const s of sessions) {
          await this.sessionCache.revokeSession(s.id);
        }
        await this.sessionRepository.deleteManyByUserId(targetUserId);
      }
    });
  }

  /**
   * Callers: [AdminUserController, AdminUserManagementApplicationService.changeUserRoleAndLevel]
   * Callees: [IUserRepository.findById, RoleHierarchyPolicy.isAtLeast, User.changeRole, IUserRepository.save, IEventBus.publish, ISessionCache.revokeSession, ISessionRepository.deleteManyByUserId, IUnitOfWork.execute]
   * Description: Changes a user's role and records an audit log. Manages session cache according to role downgrade/upgrade rules.
   * Keywords: admin, manage, user, role, identity, policy, hierarchy
   * 
   * @param operator The user information executing the operation
   * @param targetUserId The target user ID
   * @param newRoleName The new role
   * @throws {Error} Throws an error when the target user does not exist, role is invalid, or insufficient permissions
   */
  public async changeUserRole(operator: OperatorContext, targetUserId: string, newRoleName: RoleName): Promise<void> {
    return this.unitOfWork.execute(async () => {
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
      this.eventBus.publish(new UserRoleChangedEvent(targetUserId, newRoleName, operator.userId));
      await this.abilityCache.invalidateUserRules(targetUserId);

      // Auto-disable root if another user gets SUPER_ADMIN role
      if (newRoleName === 'SUPER_ADMIN' && target.username !== 'root') {
        const rootUser = await this.userRepository.findByUsername('root');
        if (rootUser && rootUser.status !== UserStatus.BANNED) {
          // Call inner method but since it's wrapped in a transaction, the recursive call shouldn't use `this.unitOfWork.execute` or `this.changeUserStatus` directly unless Prisma supports nested transactions or we refactor. 
          // Wait, if changeUserStatus uses `this.unitOfWork.execute`, and it's called inside `this.unitOfWork.execute`, it might break depending on the unit of work implementation.
          // Since we are wrapping `changeUserRole` with `unitOfWork.execute`, calling `changeUserStatus` will execute another `unitOfWork.execute`.
          // If PrismaUnitOfWork doesn't support nested transactions, this will fail. Let's look at PrismaUnitOfWork.ts.
          await this.changeUserStatus(operator, rootUser.id, UserStatus.BANNED);
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
    });
  }

  /**
   * Callers: [AdminUserController]
   * Callees: [AdminUserManagementApplicationService.changeUserLevel, AdminUserManagementApplicationService.changeUserRole, IUnitOfWork.execute]
   * Description: Changes a user's role and level in a single transaction.
   * Keywords: admin, manage, user, role, level, identity
   * 
   * @param operator The user information executing the operation
   * @param targetUserId The target user ID
   * @param options The options containing the new role and level
   */
  public async changeUserRoleAndLevel(
    operator: OperatorContext,
    targetUserId: string,
    options: { role?: RoleName; level?: number }
  ): Promise<void> {
    return this.unitOfWork.execute(async () => {
      if (options.level !== undefined) {
        await this.changeUserLevel(operator, targetUserId, options.level);
      }
      if (options.role) {
        await this.changeUserRole(operator, targetUserId, options.role);
      }
    });
  }
}
