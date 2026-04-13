import { IRouteWhitelistRepository } from '../../domain/system/IRouteWhitelistRepository';
import { RouteWhitelist, RouteWhitelistProps } from '../../domain/system/RouteWhitelist';
import { prisma } from '../../db';

export class PrismaRouteWhitelistRepository implements IRouteWhitelistRepository {
  private toDomain(raw: any): RouteWhitelist {
    const props: RouteWhitelistProps = {
      id: raw.id,
      path: raw.path,
      isPrefix: raw.isPrefix,
      minRole: raw.minRole,
      description: raw.description,
    };
    return RouteWhitelist.load(props);
  }

  public async findById(id: string): Promise<RouteWhitelist | null> {
    const raw = await prisma.routeWhitelist.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(route: RouteWhitelist): Promise<void> {
    await prisma.routeWhitelist.upsert({
      where: { id: route.id },
      create: {
        id: route.id,
        path: route.path,
        isPrefix: route.isPrefix,
        minRole: route.minRole,
        description: route.description,
      },
      update: {
        path: route.path,
        isPrefix: route.isPrefix,
        minRole: route.minRole,
        description: route.description,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.routeWhitelist.delete({ where: { id } });
  }
}
