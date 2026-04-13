import { IRouteWhitelistRepository } from '../../domain/system/IRouteWhitelistRepository';
import { RouteWhitelist } from '../../domain/system/RouteWhitelist';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { prisma } from '../../db';
import { UserStatus } from '@prisma/client';

/**
 * Callers: [AdminController, InstallController]
 * Callees: [IRouteWhitelistRepository]
 * Description: The Application Service for the System Domain. Orchestrates gateway routes and other system settings.
 * Keywords: system, service, application, orchestration, route, whitelist
 */
export class SystemApplicationService {
  constructor(private routeWhitelistRepository: IRouteWhitelistRepository) {}

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
   * Creates a temporary root user for installation.
   * Returns the generated temporary install token.
   */
  public async createTemporaryRootUser(): Promise<string> {
    const installToken = crypto.randomBytes(16).toString('hex');
    const hashedPass = await argon2.hash(crypto.randomBytes(16).toString('hex'));

    // We still use Prisma here for the initial bootstrap because domain repositories 
    // might not be fully functional or we need to upsert roles. This is acceptable
    // for a one-time bootstrap script, but kept isolated in the System service.
    let role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) {
      role = await prisma.role.create({ data: { name: 'SUPER_ADMIN', description: 'System Administrator' } });
    }

    await prisma.user.upsert({
      where: { username: 'temp_root_install' },
      update: { roleId: role.id, status: UserStatus.ACTIVE, password: hashedPass },
      create: {
        username: 'temp_root_install',
        email: 'temp_root@install.local',
        password: hashedPass,
        roleId: role.id,
        status: UserStatus.ACTIVE
      }
    });

    return installToken;
  }

  public async finalizeInstallation(username: string, email: string, password: string): Promise<string> {
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) {
      throw new Error('ERR_ROLE_NOT_FOUND');
    }

    const hashedPass = await argon2.hash(password);

    let user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username,
          email,
          password: hashedPass,
          roleId: role.id,
          status: UserStatus.ACTIVE
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPass,
          roleId: role.id,
          status: UserStatus.ACTIVE
        }
      });
    }

    await prisma.user.updateMany({
      where: { username: 'temp_root_install' },
      data: { status: UserStatus.BANNED }
    });

    return user.id;
  }
}
