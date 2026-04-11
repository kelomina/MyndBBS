import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing existing private messages with NULL deletedBy...');
  try {
    const res = await prisma.$executeRaw`UPDATE "PrivateMessage" SET "deletedBy" = ARRAY[]::text[] WHERE "deletedBy" IS NULL`;
    console.log(`Fixed ${res} messages.`);
  } catch (e) {
    console.error('Failed to run fix-db script. Your database might be fine or using a different dialect.', e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
