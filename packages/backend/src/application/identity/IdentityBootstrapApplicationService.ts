import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { User } from '../../domain/identity/User';
import { UserStatus } from '@myndbbs/shared';
import { Role } from '../../domain/identity/Role';
import { randomUUID as uuidv4 } from 'crypto';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

/**
 * Callers: [InstallationApplicationService]
 * Callees: [IUserRepository, IRoleRepository, IPasswordHasher, IUnitOfWork]
 * Description: Bootstraps the identity system, typically used during setup to create the initial super admin user.
 * Keywords: bootstrap, identity, superadmin, setup, init
 */
export interface IdentityBootstrapApplicationServiceOptions {
  userRepository: IUserRepository
  roleRepository: IRoleRepository
  passwordHasher: IPasswordHasher
  unitOfWork: IUnitOfWork
}
export class IdentityBootstrapApplicationService {
  constructor(private readonly opts: IdentityBootstrapApplicationServiceOptions) {}

  /**
   * Callers: [InstallationApplicationService]
   * Callees: [IRoleRepository.findByName, Role.create, IRoleRepository.save, IPasswordHasher.hash, IUserRepository.findByUsername, IUserRepository.findByEmail, User.updateProfile, User.changeRole, User.changeStatus, IUserRepository.save, User.create, IUnitOfWork.execute]
   * Description: Creates or updates the super admin user, and ensures the system user exists.
   * Keywords: bootstrap, superadmin, identity, setup, command
   */
  public async bootstrapSuperAdmin(username: string, email: string, password: string): Promise<string> {
    return this.opts.unitOfWork.execute(async () => {
      let role = await this.opts.roleRepository.findByName('SUPER_ADMIN');
      if (!role) {
        role = Role.create({ id: uuidv4(), name: 'SUPER_ADMIN', description: 'System Administrator', permissions: [] });
        await this.opts.roleRepository.save(role);
      }

      let adminRole = await this.opts.roleRepository.findByName('ADMIN');
      if (!adminRole) {
        adminRole = Role.create({ id: uuidv4(), name: 'ADMIN', description: 'Administrator', permissions: [] });
        await this.opts.roleRepository.save(adminRole);
      }

      let systemUser = await this.opts.userRepository.findByUsername('system');
      if (!systemUser) {
        const hashedSystemPass = await this.opts.passwordHasher.hash(uuidv4());
        systemUser = User.create({
          id: uuidv4(),
          username: 'system',
          email: 'system@localhost',
          password: hashedSystemPass,
          roleId: adminRole.id,
          status: UserStatus.ACTIVE,
          level: 4,
          isPasskeyMandatory: false,
          totpSecret: null,
          isTotpEnabled: false,
          avatarUrl: null,
          createdAt: new Date()
        });
        await this.opts.userRepository.save(systemUser);
      }

      const hashedPass = await this.opts.passwordHasher.hash(password);
      let user = await this.opts.userRepository.findByUsername(username) || await this.opts.userRepository.findByEmail(email);

      if (user) {
        user.updateProfile(email, username, hashedPass);
        user.changeRole(role.id);
        user.changeStatus(UserStatus.ACTIVE);
        await this.opts.userRepository.save(user);
      } else {
        user = User.create({
          id: uuidv4(),
          username,
          email,
          password: hashedPass,
          roleId: role.id,
          status: UserStatus.ACTIVE,
          level: 4,
          isPasskeyMandatory: false,
          totpSecret: null,
          isTotpEnabled: false,
          avatarUrl: null,
          createdAt: new Date()
        });
        await this.opts.userRepository.save(user);
      }
      return user.id;
    });
  }
}
