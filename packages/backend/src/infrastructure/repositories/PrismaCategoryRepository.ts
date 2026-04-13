import { ICategoryRepository } from '../../domain/community/ICategoryRepository';
import { Category, CategoryProps } from '../../domain/community/Category';
import { prisma } from '../../db';

/**
 * Callers: [CommunityApplicationService.constructor]
 * Callees: [toDomain, findUnique, upsert, delete]
 * Description: The Prisma-based implementation of the ICategoryRepository, mapping between raw Prisma rows and the Category Domain Aggregate.
 * Keywords: prisma, category, repository, implementation, infrastructure
 */
export class PrismaCategoryRepository implements ICategoryRepository {
  /**
   * Callers: [findById]
   * Callees: [Category.create]
   * Description: Maps a raw Prisma category row to the Category Domain Aggregate Root.
   * Keywords: mapper, domain, prisma, convert, category
   */
  private toDomain(raw: any): Category {
    const props: CategoryProps = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      sortOrder: raw.sortOrder,
      minLevel: raw.minLevel,
      createdAt: raw.createdAt,
    };
    return Category.create(props);
  }

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [prisma.category.findUnique, toDomain]
   * Description: Retrieves a Category aggregate from the Prisma database using its ID.
   * Keywords: find, id, prisma, repository, category
   */
  public async findById(id: string): Promise<Category | null> {
    const raw = await prisma.category.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [prisma.category.upsert]
   * Description: Persists the state of a Category aggregate. Creates it if it doesn't exist, updates it if it does.
   * Keywords: save, upsert, update, create, prisma, repository, category
   */
  public async save(category: Category): Promise<void> {
    await prisma.category.upsert({
      where: { id: category.id },
      create: {
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        minLevel: category.minLevel,
        createdAt: category.createdAt,
      },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        minLevel: category.minLevel,
      },
    });
  }

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [prisma.category.delete]
   * Description: Permanently removes a Category from the Prisma database.
   * Keywords: delete, remove, physical, prisma, repository, category
   */
  public async delete(id: string): Promise<void> {
    await prisma.category.delete({ where: { id } });
  }
}
