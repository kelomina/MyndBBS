import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { User, UserStatus } from '../../domain/identity/User';
import { Role } from '../../domain/identity/Role';
import { randomUUID as uuidv4 } from 'crypto';

export class IdentityBootstrapApplicationService {
  constructor(
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository,
    private passwordHasher: IPasswordHasher
  ) {}

  public async bootstrapSuperAdmin(username: string, email: string, password: string): Promise<string> {
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
  }
}
