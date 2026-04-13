import { IRouteWhitelistRepository } from '../../domain/system/IRouteWhitelistRepository';
import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { RouteWhitelist } from '../../domain/system/RouteWhitelist';
import { User, UserStatus } from '../../domain/identity/User';
import { Role } from '../../domain/identity/Role';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import fs from 'fs/promises';
import { PrismaClient } from '@prisma/client';

/**
 * Callers: [AdminController, InstallController]
 * Callees: [IRouteWhitelistRepository]
 * Description: The Application Service for the System Domain. Orchestrates gateway routes and other system settings.
 * Keywords: system, service, application, orchestration, route, whitelist
 */
export class SystemApplicationService {
  constructor(
    private routeWhitelistRepository: IRouteWhitelistRepository,
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository
  ) {}

  public async addRouteWhitelist(path: string, isPrefix: boolean, minRole: string | null, description: string | null): Promise<RouteWhitelist> {
    const route = RouteWhitelist.create({
      id: uuidv4(),
      path,
      isPrefix,
      minRole,
      description,
    });
    await this.routeWhitelistRepository.save(route);
    return route;
  }

  public async updateRouteWhitelist(id: string, path: string, isPrefix: boolean, minRole: string | null, description: string | null): Promise<RouteWhitelist> {
    const route = await this.routeWhitelistRepository.findById(id);
    if (!route) throw new Error('ERR_ROUTE_NOT_FOUND');
    
    route.update(path, isPrefix, minRole, description);
    await this.routeWhitelistRepository.save(route);
    return route;
  }

  public async deleteRouteWhitelist(id: string): Promise<void> {
    const route = await this.routeWhitelistRepository.findById(id);
    if (!route) throw new Error('ERR_ROUTE_NOT_FOUND');
    await this.routeWhitelistRepository.delete(id);
  }

  /**
   * Initializes the database schema via Prisma push.
   * Returns a promise that resolves when the push is complete.
   */
  public async initializeDatabaseSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec('npx prisma db push', { cwd: path.resolve(__dirname, '../../../') }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Callers: [InstallController]
   * Callees: [roleRepository.findByName, Role.create, roleRepository.save, userRepository.findByUsername, user.updateProfile, user.changeRole, user.changeStatus, userRepository.save, User.create, crypto.randomBytes, argon2.hash]
   * Description: Creates a temporary root user for the installation process and returns a token.
   * Keywords: install, root, user, system, setup
   */
  public async createTemporaryRootUser(): Promise<string> {
    const installToken = crypto.randomBytes(16).toString('hex');
    const hashedPass = await argon2.hash(crypto.randomBytes(16).toString('hex'));

    let role = await this.roleRepository.findByName('SUPER_ADMIN');
    if (!role) {
      role = Role.create({ id: uuidv4(), name: 'SUPER_ADMIN', description: 'System Administrator', permissions: [] });
      await this.roleRepository.save(role);
    }

    let user = await this.userRepository.findByUsername('temp_root_install');
    if (user) {
      user.updateProfile('temp_root@install.local', 'temp_root_install', hashedPass);
      user.changeRole(role.id);
      user.changeStatus(UserStatus.ACTIVE);
      await this.userRepository.save(user);
    } else {
      user = User.create({
        id: uuidv4(),
        username: 'temp_root_install',
        email: 'temp_root@install.local',
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

    return installToken;
  }

  /**
   * Callers: [InstallController]
   * Callees: [roleRepository.findByName, userRepository.findByUsername, userRepository.findByEmail, user.updateProfile, user.changeRole, user.changeStatus, userRepository.save, User.create, argon2.hash]
   * Description: Finalizes the installation by setting up the actual super admin user and disabling the temporary root.
   * Keywords: finalize, install, admin, system
   */
  public async finalizeInstallation(username: string, email: string, password: string): Promise<string> {
    const role = await this.roleRepository.findByName('SUPER_ADMIN');
    if (!role) {
      throw new Error('ERR_ROLE_NOT_FOUND');
    }

    const hashedPass = await argon2.hash(password);

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

    const tempUser = await this.userRepository.findByUsername('temp_root_install');
    if (tempUser) {
      tempUser.changeStatus(UserStatus.BANNED);
      await this.userRepository.save(tempUser);
    }

    return user.id;
  }

  /**
   * Callers: [AdminController]
   * Callees: [PrismaClient.$connect, PrismaClient.$disconnect, fs.readFile, fs.writeFile, initializeDatabaseSchema]
   * Description: Updates the database configuration in .env and initializes the schema.
   * Keywords: system, db, config, update
   */
  public async updateDatabaseConfiguration(newDbUrl: string): Promise<void> {
    const tempPrisma = new PrismaClient({ datasources: { db: { url: newDbUrl } } });
    await tempPrisma.$connect();
    await tempPrisma.$disconnect();

    const envPath = path.resolve(process.cwd(), '../../.env');
    let envContent = await fs.readFile(envPath, 'utf8').catch(() => '');
    
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${newDbUrl}"`);
    } else {
      envContent += `\nDATABASE_URL="${newDbUrl}"`;
    }
    
    await fs.writeFile(envPath, envContent);
    process.env.DATABASE_URL = newDbUrl;

    await this.initializeDatabaseSchema();
  }
}
