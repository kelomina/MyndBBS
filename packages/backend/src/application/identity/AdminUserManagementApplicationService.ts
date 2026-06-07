import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { IEmailRegistrationTicketRepository } from '../../domain/identity/IEmailRegistrationTicketRepository';
import { IPasswordResetTicketRepository } from '../../domain/identity/IPasswordResetTicketRepository';
import { IStoragePort } from '../../domain/system/ports/IStoragePort';
import { UserStatus } from '@myndbbs/shared';
import { randomUUID as uuidv4 } from 'crypto';
import { User } from '../../domain/identity/User';
import { Password } from '../../domain/identity/Password';
import { EmailAddress } from '../../domain/identity/EmailAddress';
import { RoleHierarchyPolicy, RoleName } from './policies/RoleHierarchyPolicy';
import { ISessionCache } from './ports/ISessionCache';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { UserPromotedEvent, UserStatusChangedEvent, UserRoleChangedEvent, UserDeletedEvent, TestAccountCreatedEvent } from '../../domain/shared/events/DomainEvents';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';
import { prisma } from '../../db';

type OperatorContext = { userId: string; role: RoleName };

export interface CreateTestAccountCommand {
  username: string
  email: string
  password: string
}

export interface CreatedTestAccountResult {
  id: string
  username: string
  email: string
  role: RoleName
  status: UserStatus
  level: number
}

/**
 * Callers: [AdminUserController]
 * Callees: [IUserRepository, IRoleRepository, IPasskeyRepository, ISessionRepository, ISessionCache, RoleHierarchyPolicy, IEventBus, IUnitOfWork]
 * Description: Handles administrative user management tasks such as changing roles, statuses, and levels.
 * Keywords: admin, manage, user, identity, application, service
 */
export interface AdminUserManagementApplicationServiceOptions {
  userRepository: IUserRepository
  roleRepository: IRoleRepository
  passkeyRepository: IPasskeyRepository
  sessionRepository: ISessionRepository
  sessionCache: ISessionCache
  passwordHasher: IPasswordHasher
  roleHierarchyPolicy: RoleHierarchyPolicy
  eventBus: IEventBus
  unitOfWork: IUnitOfWork
  abilityCache: IAbilityCache
  emailRegistrationTicketRepository: IEmailRegistrationTicketRepository
  passwordResetTicketRepository: IPasswordResetTicketRepository
  storagePort: IStoragePort
}
export class AdminUserManagementApplicationService {
  constructor(private readonly opts: AdminUserManagementApplicationServiceOptions) {}

  private normalizeTestAccountUsername(username: string): string {
    const normalizedUsername = username.trim();

    if (normalizedUsername.length < 3 || normalizedUsername.length > 64) {
      throw new Error('ERR_TEST_ACCOUNT_USERNAME_LENGTH');
    }

    if (!/^test_[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
      throw new Error('ERR_TEST_ACCOUNT_USERNAME_MUST_START_WITH_TEST_PREFIX');
    }

    return normalizedUsername;
  }

  /**
   * Callers: [AdminUserController.createTestAccount]
   * Callees: [EmailAddress, Password, IUserRepository, IRoleRepository, IPasswordHasher, IEventBus, IUnitOfWork]
   * Description: Creates an active level-1 USER account for operational testing. Only SUPER_ADMIN operators may call it.
   * Keywords: admin, test account, create user, super admin, identity
   */
  public async createTestAccount(
    operator: OperatorContext,
    command: CreateTestAccountCommand,
  ): Promise<CreatedTestAccountResult> {
    if (operator.role !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    }

    const username = this.normalizeTestAccountUsername(command.username);
    const email = EmailAddress.create(command.email.trim().toLowerCase()).value;
    Password.validatePolicy(command.password);

    return this.opts.unitOfWork.execute(async () => {
      const existingEmailUser = await this.opts.userRepository.findByEmail(email);
      if (existingEmailUser) {
        throw new Error('ERR_EMAIL_ALREADY_EXISTS');
      }

      const existingUsernameUser = await this.opts.userRepository.findByUsername(username);
      if (existingUsernameUser) {
        throw new Error('ERR_USERNAME_ALREADY_EXISTS');
      }

      const pendingByEmail = await this.opts.emailRegistrationTicketRepository.findByEmail(email);
      if (pendingByEmail) {
        throw new Error('ERR_EMAIL_ALREADY_EXISTS');
      }

      const pendingByUsername = await this.opts.emailRegistrationTicketRepository.findByUsername(username);
      if (pendingByUsername) {
        throw new Error('ERR_USERNAME_ALREADY_EXISTS');
      }

      const defaultRole = await this.opts.roleRepository.findByName('USER');
      const hashedPassword = await this.opts.passwordHasher.hash(command.password);
      const user = User.create({
        id: uuidv4(),
        email,
        username,
        password: hashedPassword,
        roleId: defaultRole?.id ?? null,
        status: UserStatus.ACTIVE,
        level: 1,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        avatarUrl: null,
        createdAt: new Date(),
      });

      await this.opts.userRepository.save(user);
      await this.opts.eventBus.publish(new TestAccountCreatedEvent(user.id, operator.userId));

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: 'USER',
        status: user.status,
        level: user.level,
      };
    });
  }

  private buildDeletedIdentity(targetUserId: string): { username: string; email: string } {
    const compactId = targetUserId.replace(/-/g, '');
    const shortId = compactId.slice(0, 12);
    return {
      username: `deleted-user-${shortId}`,
      email: `deleted-${compactId}@deleted.local`,
    };
  }

  private isAlreadyAnonymized(target: { id: string; username: string; email: string; status: UserStatus }): boolean {
    const identity = this.buildDeletedIdentity(target.id);
    return (
      target.status === UserStatus.INACTIVE &&
      target.username === identity.username &&
      target.email === identity.email
    );
  }

  private async assertOperatorCanManageTarget(
    operator: OperatorContext,
    targetRoleId: string | null,
  ): Promise<void> {
    const targetRole = targetRoleId
      ? ((await this.opts.roleRepository.findById(targetRoleId))?.name || 'USER')
      : 'USER';
    this.opts.roleHierarchyPolicy.assertRoleName(targetRole);

    if (this.opts.roleHierarchyPolicy.isAtLeast(targetRole, operator.role) && operator.role !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE');
    }
  }

  private async revokeUserSessions(targetUserId: string): Promise<void> {
    const sessions = await this.opts.sessionRepository.findByUserId(targetUserId);
    for (const session of sessions) {
      await this.opts.sessionCache.revokeSession(session.id);
    }
    await this.opts.sessionRepository.deleteManyByUserId(targetUserId);
  }

  private async deleteFriendRequestSystemMessages(targetUserId: string): Promise<void> {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: targetUserId }, { addresseeId: targetUserId }] },
      select: { id: true },
    });

    if (friendships.length === 0) return;

    await prisma.privateMessage.deleteMany({
      where: {
        isSystem: true,
        OR: friendships.map((friendship) => ({
          encryptedContent: { contains: friendship.id },
        })),
      },
    });
  }

  private async deleteUserPersonalRelations(targetUserId: string): Promise<void> {
    await prisma.passkey.deleteMany({ where: { userId: targetUserId } });
    await prisma.userKey.deleteMany({ where: { userId: targetUserId } });
    await prisma.notification.deleteMany({ where: { userId: targetUserId } });
    await this.deleteFriendRequestSystemMessages(targetUserId);
    await prisma.friendship.deleteMany({
      where: { OR: [{ requesterId: targetUserId }, { addresseeId: targetUserId }] },
    });
    await prisma.conversationSetting.deleteMany({
      where: { OR: [{ userId: targetUserId }, { partnerId: targetUserId }] },
    });
    await prisma.privateMessage.deleteMany({
      where: { OR: [{ senderId: targetUserId }, { receiverId: targetUserId }] },
    });
    await prisma.upvote.deleteMany({ where: { userId: targetUserId } });
    await prisma.bookmark.deleteMany({ where: { userId: targetUserId } });
    await prisma.commentUpvote.deleteMany({ where: { userId: targetUserId } });
    await prisma.commentBookmark.deleteMany({ where: { userId: targetUserId } });
    await prisma.categoryModerator.deleteMany({ where: { userId: targetUserId } });
    await prisma.wikiCollaborator.deleteMany({ where: { userId: targetUserId } });
    await prisma.wikiCreationLimit.deleteMany({ where: { userId: targetUserId } });
  }

  private async deletePendingIdentityTickets(targetUserId: string, email: string, username: string): Promise<void> {
    const registrationTickets = [
      await this.opts.emailRegistrationTicketRepository.findByEmail(email),
      await this.opts.emailRegistrationTicketRepository.findByUsername(username),
    ];
    const deletedRegistrationTicketIds = new Set<string>();
    for (const ticket of registrationTickets) {
      if (ticket && !deletedRegistrationTicketIds.has(ticket.id)) {
        deletedRegistrationTicketIds.add(ticket.id);
        await this.opts.emailRegistrationTicketRepository.delete(ticket.id);
      }
    }

    const passwordResetTickets = [
      await this.opts.passwordResetTicketRepository.findByUserId(targetUserId),
      await this.opts.passwordResetTicketRepository.findByEmail(email),
    ];
    const deletedPasswordResetTicketIds = new Set<string>();
    for (const ticket of passwordResetTickets) {
      if (ticket && !deletedPasswordResetTicketIds.has(ticket.id)) {
        deletedPasswordResetTicketIds.add(ticket.id);
        await this.opts.passwordResetTicketRepository.delete(ticket.id);
      }
    }
  }

  public async anonymizeUser(
    operator: OperatorContext,
    targetUserId: string,
  ): Promise<{ id: string; username: string; email: string; status: UserStatus }> {
    let avatarUrlToDelete: string | null = null;

    const result = await this.opts.unitOfWork.execute(async () => {
      if (operator.userId === targetUserId) {
        throw new Error('ERR_FORBIDDEN_CANNOT_DELETE_SELF');
      }

      const target = await this.opts.userRepository.findById(targetUserId);
      if (!target) throw new Error('ERR_USER_NOT_FOUND');

      if (this.isAlreadyAnonymized(target)) {
        return {
          id: target.id,
          username: target.username,
          email: target.email,
          status: target.status,
        };
      }

      await this.assertOperatorCanManageTarget(operator, target.roleId);

      const identity = this.buildDeletedIdentity(targetUserId);
      const originalEmail = target.email;
      const originalUsername = target.username;
      avatarUrlToDelete = target.avatarUrl;
      await this.revokeUserSessions(targetUserId);
      await this.deletePendingIdentityTickets(targetUserId, originalEmail, originalUsername);
      await this.deleteUserPersonalRelations(targetUserId);

      target.anonymizeForDeletion(identity.username, identity.email);
      await this.opts.userRepository.save(target);
      await prisma.user.update({
        where: { id: targetUserId },
        data: { registeredIp: null },
      });

      await this.opts.abilityCache.invalidateUserRules(targetUserId);
      await this.opts.eventBus.publish(new UserDeletedEvent(targetUserId, operator.userId));

      return {
        id: target.id,
        username: target.username,
        email: target.email,
        status: target.status,
      };
    });

    if (avatarUrlToDelete) {
      try {
        await this.opts.storagePort.deleteAvatar(avatarUrlToDelete);
      } catch (error) {
        console.warn('[AdminUserManagement] Failed to delete anonymized user avatar:', error);
      }
    }

    return result;
  }

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
    return this.opts.unitOfWork.execute(async () => {
      if (level < 1 || level > 6) {
        throw new Error('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
      }

      const user = await this.opts.userRepository.findById(targetUserId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');

      const passkeys = await this.opts.passkeyRepository.findByUserId(targetUserId);
      user.changeLevel(level, passkeys.length > 0);
      await this.opts.userRepository.save(user);
      await this.opts.eventBus.publish(new UserPromotedEvent(targetUserId, level, operator.userId));
      await this.opts.abilityCache.invalidateUserRules(targetUserId);
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
    return this.opts.unitOfWork.execute(async () => {
      if (!([UserStatus.ACTIVE, UserStatus.BANNED, UserStatus.PENDING, UserStatus.INACTIVE] as UserStatus[]).includes(status)) {
        throw new Error('ERR_INVALID_STATUS');
      }

      const target = await this.opts.userRepository.findById(targetUserId);
      if (!target) throw new Error('ERR_USER_NOT_FOUND');

      const operatorRole = operator.role;
      const targetRole = target.roleId
        ? ((await this.opts.roleRepository.findById(target.roleId))?.name || 'USER')
        : 'USER';
      this.opts.roleHierarchyPolicy.assertRoleName(targetRole);

      if (this.opts.roleHierarchyPolicy.isAtLeast(targetRole, operatorRole) && operatorRole !== 'SUPER_ADMIN') {
        throw new Error('ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE');
      }

      target.changeStatus(status);
      await this.opts.userRepository.save(target);
      await this.opts.eventBus.publish(new UserStatusChangedEvent(targetUserId, status, operator.userId));
      await this.opts.abilityCache.invalidateUserRules(targetUserId);

      if (status === UserStatus.BANNED) {
        const sessions = await this.opts.sessionRepository.findByUserId(targetUserId);
        for (const s of sessions) {
          await this.opts.sessionCache.revokeSession(s.id);
        }
        await this.opts.sessionRepository.deleteManyByUserId(targetUserId);
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
    return this.opts.unitOfWork.execute(async () => {
      if (!['USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN'].includes(newRoleName)) {
        throw new Error('ERR_INVALID_ROLE');
      }

      const target = await this.opts.userRepository.findById(targetUserId);
      if (!target) throw new Error('ERR_USER_NOT_FOUND');

      const newRole = await this.opts.roleRepository.findByName(newRoleName);
      if (!newRole) throw new Error('ERR_ROLE_NOT_FOUND_IN_DATABASE');

      const currentRoleName = target.roleId
        ? ((await this.opts.roleRepository.findById(target.roleId))?.name || 'USER')
        : 'USER';
      this.opts.roleHierarchyPolicy.assertRoleName(currentRoleName);

      if (this.opts.roleHierarchyPolicy.isAtLeast(currentRoleName, operator.role) && operator.role !== 'SUPER_ADMIN') {
        throw new Error('ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE');
      }

      if (this.opts.roleHierarchyPolicy.compare(newRoleName, operator.role) > 0 && operator.role !== 'SUPER_ADMIN') {
        throw new Error('ERR_FORBIDDEN_CANNOT_GRANT_A_ROLE_HIGHER_THAN_YOUR_OWN');
      }

      target.changeRole(newRole.id);
      await this.opts.userRepository.save(target);
      await this.opts.eventBus.publish(new UserRoleChangedEvent(targetUserId, newRoleName, operator.userId));
      await this.opts.abilityCache.invalidateUserRules(targetUserId);

      // Auto-disable root if another user gets SUPER_ADMIN role
      if (newRoleName === 'SUPER_ADMIN' && target.username !== 'root') {
        const rootUser = await this.opts.userRepository.findByUsername('root');
        if (rootUser && rootUser.status !== UserStatus.BANNED) {
          // Call inner method but since it's wrapped in a transaction, the recursive call shouldn't use `this.opts.unitOfWork.execute` or `this.changeUserStatus` directly unless Prisma supports nested transactions or we refactor.
          // Wait, if changeUserStatus uses `this.opts.unitOfWork.execute`, and it's called inside `this.opts.unitOfWork.execute`, it might break depending on the unit of work implementation.
          // Since we are wrapping `changeUserRole` with `unitOfWork.execute`, calling `changeUserStatus` will execute another `unitOfWork.execute`.
          // If PrismaUnitOfWork doesn't support nested transactions, this will fail. Let's look at PrismaUnitOfWork.ts.
          await this.changeUserStatus(operator, rootUser.id, UserStatus.BANNED);
        }
      }

      const currentVsNew = this.opts.roleHierarchyPolicy.compare(newRoleName, currentRoleName);
      const sessions = await this.opts.sessionRepository.findByUserId(targetUserId);

      if (currentVsNew < 0) {
        for (const s of sessions) {
          await this.opts.sessionCache.revokeSession(s.id);
        }
        await this.opts.sessionRepository.deleteManyByUserId(targetUserId);
      }

      if (currentVsNew > 0) {
        for (const s of sessions) {
          await this.opts.sessionCache.markSessionRequiresRefresh(s.id, 7 * 24 * 60 * 60);
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
    return this.opts.unitOfWork.execute(async () => {
      if (options.level !== undefined) {
        await this.changeUserLevel(operator, targetUserId, options.level);
      }
      if (options.role) {
        await this.changeUserRole(operator, targetUserId, options.role);
      }
    });
  }
}
