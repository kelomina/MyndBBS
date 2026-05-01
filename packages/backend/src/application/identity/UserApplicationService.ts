import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { User } from '../../domain/identity/User';
import { UserStatus } from '@myndbbs/shared';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

/**
 * 类名称：UserApplicationService
 *
 * 函数作用：
 *   用户上下文的应用服务——编排用户资料、TOTP、角色、等级、状态和 Cookie 偏好的更新。
 * Purpose:
 *   User context application service — orchestrates updates to user profiles, TOTP, roles, levels, statuses, and cookie preferences.
 *
 * 调用方 / Called by:
 *   - userController
 *   - adminController
 *
 * 中文关键词：
 *   用户，应用服务，资料更新，TOTP，角色，等级
 * English keywords:
 *   user, application service, profile update, TOTP, role, level
 */
export class UserApplicationService {
  /**
   * 函数名称：constructor
   *
   * 函数作用：
   *   通过依赖注入初始化服务。
   * Purpose:
   *   Initializes the service with dependency injection.
   *
   * 中文关键词：
   *   构造函数，依赖注入
   * English keywords:
   *   constructor, dependency injection
   */
  constructor(
    private userRepository: IUserRepository,
    private passkeyRepository: IPasskeyRepository,
    private abilityCache: IAbilityCache,
    private passwordHasher: IPasswordHasher,
    private totpPort: ITotpPort,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * 函数名称：updateProfile
   *
   * 函数作用：
   *   更新用户资料信息（邮箱、用户名、密码哈希）。校验邮箱和用户名的唯一性。
   * Purpose:
   *   Updates user profile info (email, username, hashed password). Validates email and username uniqueness.
   *
   * 调用方 / Called by:
   *   userController
   *
   * 被调用方 / Calls:
   *   - userRepository.findById / findByEmail / findByUsername
   *   - User.updateProfile
   *   - unitOfWork.execute
   *
   * 参数说明 / Parameters:
   *   - userId: string, 用户 ID
   *   - email: string | undefined, 新邮箱
   *   - username: string | undefined, 新用户名
   *   - hashedPassword: string | undefined, 新密码哈希
   *
   * 返回值说明 / Returns:
   *   { id, email, username, roleId }
   *
   * 错误处理 / Error handling:
   *   - ERR_USER_NOT_FOUND（用户不存在）
   *   - ERR_EMAIL_ALREADY_IN_USE / ERR_USERNAME_ALREADY_IN_USE（重复）
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理事务
   *
   * 中文关键词：
   *   更新资料，邮箱，用户名，密码
   * English keywords:
   *   update profile, email, username, password
   */
  public async updateProfile(userId: string, email?: string, username?: string, hashedPassword?: string): Promise<any> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');

      if (email && email !== user.email) {
        const existing = await this.userRepository.findByEmail(email);
        if (existing) throw new Error('ERR_EMAIL_ALREADY_IN_USE');
      }
      if (username && username !== user.username) {
        const existing = await this.userRepository.findByUsername(username);
        if (existing) throw new Error('ERR_USERNAME_ALREADY_IN_USE');
      }

      user.updateProfile(email, username, hashedPassword);
      await this.userRepository.save(user);

      return { id: user.id, email: user.email, username: user.username, roleId: user.roleId };
    });
  }

  /**
   * 函数名称：enableTotp
   *
   * 函数作用：
   *   为用户启用 TOTP 双因素认证。
   * Purpose:
   *   Enables TOTP two-factor authentication for a user.
   *
   * 调用方 / Called by:
   *   userController
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   启用，TOTP，双因素认证
   * English keywords:
   *   enable, TOTP, two-factor auth
   */
  public async enableTotp(userId: string, secret: string): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');
      user.enableTotp(secret);
      await this.userRepository.save(user);
    });
  }

  /**
   * 函数名称：disableTotp
   *
   * 函数作用：
   *   为用户禁用 TOTP 双因素认证。
   * Purpose:
   *   Disables TOTP two-factor authentication for a user.
   *
   * 调用方 / Called by:
   *   userController.disableTotp
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   禁用，TOTP，双因素认证
   * English keywords:
   *   disable, TOTP, two-factor auth
   */
  public async disableTotp(userId: string): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');
      user.disableTotp();
      await this.userRepository.save(user);
    });
  }

  /**
   * 函数名称：changeRole
   *
   * 函数作用：
   *   变更用户角色并使权限缓存失效。
   * Purpose:
   *   Changes a user's role and invalidates the ability cache.
   *
   * 调用方 / Called by:
   *   adminController
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   变更角色，权限缓存
   * English keywords:
   *   change role, ability cache
   */
  public async changeRole(userId: string, roleId: string | null): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');
      user.changeRole(roleId);
      await this.userRepository.save(user);
      await this.abilityCache.invalidateUserRules(userId);
    });
  }

  /**
   * 函数名称：changeLevel
   *
   * 函数作用：
   *   变更用户安全等级，要求升级到 2 级以上时必须已有 Passkey。
   * Purpose:
   *   Changes a user's security level. Requires at least one passkey to promote above level 1.
   *
   * 调用方 / Called by:
   *   adminController
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   变更等级，Passkey，安全等级
   * English keywords:
   *   change level, passkey, security level
   */
  public async changeLevel(userId: string, level: number): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');

      const passkeys = await this.passkeyRepository.findByUserId(userId);
      user.changeLevel(level, passkeys.length > 0);

      await this.userRepository.save(user);
      await this.abilityCache.invalidateUserRules(userId);
    });
  }

  /**
   * 函数名称：changeStatus
   *
   * 函数作用：
   *   变更用户状态并使权限缓存失效。
   * Purpose:
   *   Changes a user's status and invalidates the ability cache.
   *
   * 调用方 / Called by:
   *   adminController
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   变更状态，禁用，激活
   * English keywords:
   *   change status, ban, activate
   */
  public async changeStatus(userId: string, status: UserStatus): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');
      user.changeStatus(status);
      await this.userRepository.save(user);
      await this.abilityCache.invalidateUserRules(userId);
    });
  }

  /**
   * 函数名称：updateCookiePreferences
   *
   * 函数作用：
   *   更新用户 Cookie 偏好设置。
   * Purpose:
   *   Updates a user's cookie preferences.
   *
   * 调用方 / Called by:
   *   userController.updateCookiePreferences
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理
   *
   * 中文关键词：
   *   Cookie，偏好，更新
   * English keywords:
   *   cookie, preferences, update
   */
  public async updateCookiePreferences(userId: string, preferences: any): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');
      user.updateCookiePreferences(preferences);
      await this.userRepository.save(user);
    });
  }
}
