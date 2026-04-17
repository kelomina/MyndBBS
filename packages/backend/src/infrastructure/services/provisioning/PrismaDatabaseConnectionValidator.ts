import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { IDatabaseConnectionValidator } from '../../../domain/provisioning/IDatabaseConnectionValidator';

export class PrismaDatabaseConnectionValidator implements IDatabaseConnectionValidator {
  async validate(dbUrl: string): Promise<boolean> {
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    const tempPrisma = new PrismaClient({ adapter });
    try {
      await tempPrisma.$connect();
      // Test the connection by running a simple query
      await tempPrisma.$queryRawUnsafe('SELECT 1');
      return true;
    } catch (e) {
      return false;
    } finally {
      await tempPrisma.$disconnect();
      await pool.end();
    }
  }
}
