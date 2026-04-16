import { PrismaClient } from '@prisma/client';
import { IDatabaseConnectionValidator } from '../../../domain/provisioning/IDatabaseConnectionValidator';

export class PrismaDatabaseConnectionValidator implements IDatabaseConnectionValidator {
  async validate(dbUrl: string): Promise<boolean> {
    const tempPrisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    try {
      await tempPrisma.$connect();
      return true;
    } catch (e) {
      return false;
    } finally {
      await tempPrisma.$disconnect();
    }
  }
}
