import { PrismaClient, Prisma } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { AsyncLocalStorage } from 'async_hooks';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const basePrisma = new PrismaClient({ adapter });

/**
 * AsyncLocalStorage to hold the current Prisma transaction client.
 */
export const prismaTxLocalStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

/**
 * A proxy around the PrismaClient that automatically uses the transaction client
 * if one is available in the current AsyncLocalStorage context.
 */
export const prisma = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    const tx = prismaTxLocalStorage.getStore();
    if (tx && Reflect.has(tx, prop)) {
      return Reflect.get(tx, prop, receiver);
    }
    return Reflect.get(target, prop, receiver);
  }
});

export { basePrisma };
