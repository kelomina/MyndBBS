/**
 * 仓储实现：PrismaSitePolicyRepository
 */
import { ISitePolicyRepository } from '../../domain/system/ISitePolicyRepository';
import { prisma } from '../../db';

export class PrismaSitePolicyRepository implements ISitePolicyRepository {
  public async get(key: string): Promise<unknown | null> {
    const row = await prisma.sitePolicy.findUnique({ where: { key } });
    return row ? row.value : null;
  }

  public async set(key: string, value: unknown): Promise<void> {
    await prisma.sitePolicy.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }
}
