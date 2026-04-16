import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { UserStatus } from '../../domain/identity/User';
import { RoleHierarchyPolicy, RoleName } from './policies/RoleHierarchyPolicy';
import { ISessionCache } from './ports/ISessionCache';

type OperatorContext = { userId: string; role: RoleName };

export class AdminUserManagementApplicationService {
  constructor(
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository,
    private passkeyRepository: IPasskeyRepository,
    private sessionRepository: ISessionRepository,
    private sessionCache: ISessionCache,
    private roleHierarchyPolicy: RoleHierarchyPolicy
  ) {}

  public async changeUserLevel(targetUserId: string, level: number): Promise<void> {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    if (level > 1) {
      const passkeys = await this.passkeyRepository.findByUserId(targetUserId);
      if (passkeys.length === 0) throw new Error('ERR_CANNOT_PROMOTE_WITHOUT_PASSKEY');
    }

    user.changeLevel(level);
    await this.userRepository.save(user);
  }

  public async changeUserStatus(operator: OperatorContext, targetUserId: string, status: UserStatus): Promise<void> {
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

    if (status === UserStatus.BANNED) {
      const sessions = await this.sessionRepository.findByUserId(targetUserId);
      for (const s of sessions) {
        await this.sessionCache.revokeSession(s.id);
      }
      await this.sessionRepository.deleteManyByUserId(targetUserId);
    }
  }

  public async changeUserRole(operator: OperatorContext, targetUserId: string, newRoleName: RoleName): Promise<void> {
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
}
