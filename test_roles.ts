import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const roles = await prisma.role.findMany();
  console.log(roles.map(r => r.name));
}
test().finally(() => prisma.$disconnect());
