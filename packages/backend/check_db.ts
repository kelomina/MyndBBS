import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Callers: []
 * Callees: [findMany, log, map, substring]
 * Description: Handles the test logic for the application.
 * Keywords: test, auto-annotated
 */
async function test() {
  const msgs = await prisma.privateMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Latest messages:', msgs.map(m => ({ id: m.id, senderId: m.senderId, receiverId: m.receiverId, encrypted: m.encryptedContent.substring(0,10), senderEncrypted: m.senderEncryptedContent?.substring(0,10), expiresAt: m.expiresAt, createdAt: m.createdAt })));
}
test().finally(() => prisma.$disconnect());
