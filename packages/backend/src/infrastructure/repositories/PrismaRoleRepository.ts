/**
 * 类名称：PrismaRoleRepository
 *
 * 函数作用：
 *   Prisma 实现的角色仓储，映射 Prisma 行记录到领域 Role 聚合根。
 * Purpose:
 *   Prisma-based Role repository, mapping Prisma rows to the Role domain aggregate root.
 *
 * 中文关键词：
 *   Prisma，角色，仓储实现
 * English keywords:
 *   Prisma, role, repository implementation
 */
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { Role, RoleProps } from '../../domain/identity/Role';
import { Permission, PermissionProps } from '../../domain/identity/Permission';
import { prisma } from '../../db';

export class PrismaRoleRepository implements IRoleRepository {
  /**
   * 函数名称：toDomain
   *
   * 函数作用：
   *   将 Prisma 原始行记录映射为领域 Role 聚合根（含权限）。
   * Purpose:
   *   Maps a raw Prisma row to the Role domain aggregate root (with permissions).
   */
  private toDomain(raw: any): Role {
    const permissions: Permission[] = (raw.permissions || []).map((rp: any) => {
      const p = rp.permission;
      const props: PermissionProps = {
        id: p.id,
        action: p.action,
        subject: p.subject,
        conditions: p.conditions ? JSON.stringify(p.conditions) : null,
      };
      return Permission.load(props);
    });

    const props: RoleProps = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      permissions,
    };
    return Role.load(props);
  }

  /**
   * 函数名称：findById
   *
   * 函数作用：
   *   按 ID 查找角色（含权限）。
   * Purpose:
   *   Finds a role by ID (with permissions).
   */
  public async findById(id: string): Promise<Role | null> {
    const raw = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * 函数名称：findByName
   *
   * 函数作用：
   *   按名称查找角色（含权限）。
   * Purpose:
   *   Finds a role by name (with permissions).
   */
  public async findByName(name: string): Promise<Role | null> {
    const raw = await prisma.role.findUnique({
      where: { name },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(role: Role): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.role.upsert({
        where: { id: role.id },
        create: {
          id: role.id,
          name: role.name,
          description: role.description,
        },
        update: {
          name: role.name,
          description: role.description,
        },
      });

      const permissionIds = role.permissions.map(p => p.id);

      // Remove permissions not present in the aggregate
      await tx.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: { notIn: permissionIds }
        }
      });

      // Add permissions present in the aggregate
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map(permissionId => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.role.delete({ where: { id } });
  }
}
