import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const msg = await prisma.privateMessage.findFirst();
  console.log('msg', msg?.id);
}
test().finally(() => prisma.$disconnect());
