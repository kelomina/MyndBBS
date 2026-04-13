import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { Role, RoleProps } from '../../domain/identity/Role';
import { Permission, PermissionProps } from '../../domain/identity/Permission';
import { prisma } from '../../db';

export class PrismaRoleRepository implements IRoleRepository {
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
