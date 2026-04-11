import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const user1 = await prisma.user.findFirst();
  const user2 = await prisma.user.findFirst({ where: { id: { not: user1?.id } } });

  if (!user1 || !user2) {
    console.log('Not enough users');
    return;
  }

  console.log('User1:', user1.username);
  console.log('User2:', user2.username);

  const msg = await prisma.privateMessage.create({
    data: {
      senderId: user1.id,
      receiverId: user2.id,
      ephemeralPublicKey: 'test_key',
      encryptedContent: 'test_content',
      senderEncryptedContent: 'test_content',
      expiresAt: new Date(Date.now() + 60000),
      deletedBy: []
    }
  });

  console.log('Created message:', msg.id);

  const notExpiredCondition = {
    OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ]
  };

  const inbox = await prisma.privateMessage.findMany({
    where: {
      AND: [
        {
          OR: [
            { senderId: user1.id, receiverId: user2.id },
            { senderId: user2.id, receiverId: user1.id }
          ]
        },
        notExpiredCondition
      ]
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ]
  });

  console.log('Inbox length:', inbox.length);
  if (inbox.length > 0) {
    console.log('Latest message matches:', inbox[0].id === msg.id);
  }
}
test().finally(() => prisma.$disconnect());
