import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { User } from '../../domain/identity/User';
import { UserStatus } from '@myndbbs/shared';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

/**
 * Callers: [UserController, AdminController]
 * Callees: [IUserRepository.findById, IUserRepository.findByEmail, IUserRepository.findByUsername, User.updateProfile, User.enableTotp, User.disableTotp, User.changeRole, User.changeLevel, User.changeStatus, IUserRepository.save, IUnitOfWork.execute]
 * Description: The Application Service for the Identity Domain (User context). Orchestrates updates to user profiles, roles, levels, and statuses.
 * Keywords: identity, service, application, orchestration, user, profile, totp, level, role
 */
export class UserApplicationService {
  /**
   * Callers: [UserController, AdminController]
   * Callees: []
   * Description: Initializes the service with the User repository and Unit of Work.
   * Keywords: constructor, inject, repository, service, identity, user
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
   * Callers: [UserController]
   * Callees: [IUserRepository.findById, IUserRepository.findByEmail, IUserRepository.findByUsername, User.updateProfile, IUserRepository.save, IUnitOfWork.execute]
   * Description: Updates a user's profile details (email, username, password).
   * Keywords: update, profile, user, identity
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
   * Callers: [UserController]
   * Callees: [IUserRepository.findById, User.enableTotp, IUserRepository.save, IUnitOfWork.execute]
   * Description: Enables TOTP for a user.
   * Keywords: enable, totp, user, identity
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
   * Callers: [UserController]
   * Callees: [IUserRepository.findById, User.disableTotp, IUserRepository.save, IUnitOfWork.execute]
   * Description: Disables TOTP for a user.
   * Keywords: disable, totp, user, identity
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
   * Callers: [AdminController]
   * Callees: [IUserRepository.findById, User.changeRole, IUserRepository.save, IAbilityCache.invalidateUserRules, IUnitOfWork.execute]
   * Description: Changes a user's role and invalidates their ability cache.
   * Keywords: change, role, user, identity
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
   * Callers: [AdminController]
   * Callees: [IUserRepository.findById, IPasskeyRepository.findByUserId, User.changeLevel, IUserRepository.save, IAbilityCache.invalidateUserRules, IUnitOfWork.execute]
   * Description: Changes a user's security level. Retrieves user passkeys to enforce the rule that a user cannot be promoted above level 1 without a passkey.
   * Keywords: change, level, user, identity, promote, passkey
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
   * Callers: [AdminController]
   * Callees: [IUserRepository.findById, User.changeStatus, IUserRepository.save, IAbilityCache.invalidateUserRules, IUnitOfWork.execute]
   * Description: Changes a user's status and invalidates their ability cache.
   * Keywords: change, status, user, identity
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
}
