import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { User } from '../../domain/identity/User';
import { UserStatus } from '@myndbbs/shared';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';

/**
 * Callers: [UserController, AdminController]
 * Callees: [IUserRepository.findById, IUserRepository.findByEmail, IUserRepository.findByUsername, User.updateProfile, User.enableTotp, User.disableTotp, User.changeRole, User.changeLevel, User.changeStatus, IUserRepository.save]
 * Description: The Application Service for the Identity Domain (User context). Orchestrates updates to user profiles, roles, levels, and statuses.
 * Keywords: identity, service, application, orchestration, user, profile, totp, level, role
 */
export class UserApplicationService {
  /**
   * Callers: [UserController, AdminController]
   * Callees: []
   * Description: Initializes the service with the User repository.
   * Keywords: constructor, inject, repository, service, identity, user
   */
  constructor(
    private userRepository: IUserRepository,
    private abilityCache: IAbilityCache,
    private passwordHasher: IPasswordHasher,
    private totpPort: ITotpPort
  ) {}

  public async disableTotpWithVerification(
    userId: string,
    currentPassword?: string,
    totpCode?: string
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    if (!currentPassword && !totpCode) {
      throw new Error('ERR_CURRENT_PASSWORD_OR_TOTP_CODE_REQUIRED_TO_DISABLE_2FA');
    }
    if (currentPassword && user.password) {
      const isValid = await this.passwordHasher.verify(user.password, currentPassword);
      if (!isValid) throw new Error('ERR_INVALID_CURRENT_PASSWORD');
    }
    if (totpCode && user.totpSecret) {
      const isValid = this.totpPort.verify(user.totpSecret, totpCode);
      if (!isValid) throw new Error('ERR_INVALID_TOTP_CODE');
    }

    user.disableTotp();
    await this.userRepository.save(user);
  }

  public async updateProfile(userId: string, email?: string, username?: string, hashedPassword?: string): Promise<any> {
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
  }

  public async enableTotp(userId: string, secret: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.enableTotp(secret);
    await this.userRepository.save(user);
  }

  public async disableTotp(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.disableTotp();
    await this.userRepository.save(user);
  }

  public async changeRole(userId: string, roleId: string | null): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.changeRole(roleId);
    await this.userRepository.save(user);
    await this.abilityCache.invalidateUserRules(userId);
  }

  public async changeLevel(userId: string, level: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.changeLevel(level);
    await this.userRepository.save(user);
    await this.abilityCache.invalidateUserRules(userId);
  }

  public async changeStatus(userId: string, status: UserStatus): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.changeStatus(status);
    await this.userRepository.save(user);
    await this.abilityCache.invalidateUserRules(userId);
  }
}
