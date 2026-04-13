import { IPermissionRepository } from '../../domain/identity/IPermissionRepository';
import { Permission, PermissionProps } from '../../domain/identity/Permission';
import { prisma } from '../../db';

export class PrismaPermissionRepository implements IPermissionRepository {
  private toDomain(raw: any): Permission {
    const props: PermissionProps = {
      id: raw.id,
      action: raw.action,
      subject: raw.subject,
      conditions: raw.conditions ? JSON.stringify(raw.conditions) : null,
    };
    return Permission.load(props);
  }

  public async findById(id: string): Promise<Permission | null> {
    const raw = await prisma.permission.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(permission: Permission): Promise<void> {
    const conditionsData = permission.conditions ? JSON.parse(permission.conditions) : null;
    
    await prisma.permission.upsert({
      where: { id: permission.id },
      create: {
        id: permission.id,
        action: permission.action,
        subject: permission.subject,
        conditions: conditionsData,
      },
      update: {
        action: permission.action,
        subject: permission.subject,
        conditions: conditionsData,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.permission.delete({ where: { id } });
  }
}
