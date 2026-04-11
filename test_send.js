const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const sender = await prisma.user.findFirst();
    const receiver = await prisma.user.findFirst({ where: { id: { not: sender.id } } });
    
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
        senderEncryptedContent: 'test_sender_content',
        expiresAt: new Date(Date.now() + 60000)
      }
    });
    console.log('Created message:', msg);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
