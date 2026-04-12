const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.post.findMany({ take: 1 });
  console.log(JSON.stringify(posts[0].content));
}
main().catch(console.error).finally(() => prisma.$disconnect());
