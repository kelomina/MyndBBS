import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.post.findMany({
    where: {
      category: {
        is: {
          sortOrder: { lte: 10 }
        }
      }
    }
  });
  console.log(posts.length);
}
main();
