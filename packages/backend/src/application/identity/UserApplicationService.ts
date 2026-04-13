import { IUserRepository } from '../../domain/identity/IUserRepository';
import { User, UserStatus } from '../../domain/identity/User';
import redis from '../../lib/redis';

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
  constructor(private userRepository: IUserRepository) {}

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
    await redis.del(`ability_rules:user:${userId}`);
  }

  public async changeLevel(userId: string, level: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.changeLevel(level);
    await this.userRepository.save(user);
    await redis.del(`ability_rules:user:${userId}`);
  }

  public async changeStatus(userId: string, status: UserStatus): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    user.changeStatus(status);
    await this.userRepository.save(user);
    await redis.del(`ability_rules:user:${userId}`);
  }
}
