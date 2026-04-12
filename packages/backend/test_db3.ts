import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Callers: []
 * Callees: [String, findMany, log]
 * Description: Handles the test logic for the application.
 * Keywords: test, auto-annotated
 */
async function test() {
  const userId = '921a558c-9b0e-40cc-b0fd-fa13184819e8';
  const withUserId = 'c55417b9-05ee-4f4b-88e4-12d542a98545';

  const whereClause = {
    AND: [
      {
        OR: [
          { senderId: userId, receiverId: String(withUserId) },
          { senderId: String(withUserId), receiverId: userId }
        ]
      },
      { OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ] },
      { NOT: { deletedBy: { has: userId } } }
    ]
  };

  const msgs = await prisma.privateMessage.findMany({ where: whereClause });
  console.log('Query with whereClause:', msgs.length);

  const msgs2 = await prisma.privateMessage.findMany({
    where: {
        OR: [
          { senderId: userId, receiverId: String(withUserId) },
          { senderId: String(withUserId), receiverId: userId }
        ]
    }
  });
  console.log('Query without NOT deletedBy and expiresAt:', msgs2.length);

  const msgs3 = await prisma.privateMessage.findMany({
    where: {
      AND: [
        {
          OR: [
            { senderId: userId, receiverId: String(withUserId) },
            { senderId: String(withUserId), receiverId: userId }
          ]
        },
        { NOT: { deletedBy: { has: userId } } }
      ]
    }
  });
  console.log('Query with deletedBy only:', msgs3.length);

}
test().finally(() => prisma.$disconnect());
