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

  const notExpiredCondition = {
    OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ]
  };

  const whereClause = {
    AND: [
      {
        OR: [
          { senderId: userId, receiverId: String(withUserId) },
          { senderId: String(withUserId), receiverId: userId }
        ]
      },
      notExpiredCondition,
      { NOT: { deletedBy: { has: userId } } }
    ]
  };

  const msgs = await prisma.privateMessage.findMany({ where: whereClause });
  console.log('Messages:', msgs.length);

  const allMsgs = await prisma.privateMessage.findMany({
    where: {
        OR: [
          { senderId: userId, receiverId: String(withUserId) },
          { senderId: String(withUserId), receiverId: userId }
        ]
    }
  });
  console.log('All Messages between these two:', allMsgs.length);
}
test().finally(() => prisma.$disconnect());
