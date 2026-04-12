import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
/**
 * Callers: []
 * Callees: [findMany, log]
 * Description: Handles the main logic for the application.
 * Keywords: main, auto-annotated
 */
async function main() {
  const posts = await prisma.post.findMany({
    where: {
      category: {
        sortOrder: { lte: 10 }
      }
    }
  });
  console.log(posts.length);
}
main();
