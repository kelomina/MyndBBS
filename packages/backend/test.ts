import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Callers: []
 * Callees: [findFirst, log, create, now, error, $disconnect]
 * Description: Handles the test logic for the application.
 * Keywords: test, auto-annotated
 */
async function test() {
  try {
    const sender = await prisma.user.findFirst();
    const receiver = await prisma.user.findFirst({ where: { id: { not: sender!.id } } });
    
    if (!sender || !receiver) {
      console.log('Not enough users');
      return;
    }

    const msg = await prisma.privateMessage.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        ephemeralPublicKey: 'test_pub_key',
        encryptedContent: 'test_content',
        senderEncryptedContent: undefined,
        expiresAt: new Date(Date.now() + 60000)
      }
    });
    console.log('Created message with senderEncryptedContent=undefined:', msg);

    const msg2 = await prisma.privateMessage.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        ephemeralPublicKey: 'test_pub_key',
        encryptedContent: 'test_content',
        senderEncryptedContent: null,
        expiresAt: new Date(Date.now() + 60000)
      }
    });
    console.log('Created message with senderEncryptedContent=null:', msg2);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
