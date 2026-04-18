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
export class IdentityBootstrapApplicationService {
  constructor(
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository,
    private passwordHasher: IPasswordHasher,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * Callers: [InstallationApplicationService]
   * Callees: [IRoleRepository.findByName, Role.create, IRoleRepository.save, IPasswordHasher.hash, IUserRepository.findByUsername, IUserRepository.findByEmail, User.updateProfile, User.changeRole, User.changeStatus, IUserRepository.save, User.create, IUnitOfWork.execute]
   * Description: Creates or updates the super admin user. Ensures the SUPER_ADMIN role exists.
   * Keywords: bootstrap, superadmin, identity, setup, command
   */
  public async bootstrapSuperAdmin(username: string, email: string, password: string): Promise<string> {
    return this.unitOfWork.execute(async () => {
      let role = await this.roleRepository.findByName('SUPER_ADMIN');
      if (!role) {
        role = Role.create({ id: uuidv4(), name: 'SUPER_ADMIN', description: 'System Administrator', permissions: [] });
        await this.roleRepository.save(role);
      }

      const hashedPass = await this.passwordHasher.hash(password);
      let user = await this.userRepository.findByUsername(username) || await this.userRepository.findByEmail(email);

      if (user) {
        user.updateProfile(email, username, hashedPass);
        user.changeRole(role.id);
        user.changeStatus(UserStatus.ACTIVE);
        await this.userRepository.save(user);
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
          createdAt: new Date()
        });
        await this.userRepository.save(user);
      }
      return user.id;
    });
  }
}
