const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/lib/notification.ts');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('notifyModerators')) {
  content += `\n
export const notifyModerators = async (title: string, content: string, relatedId?: string) => {
  // Find users with level >= 3 (Moderators, Admins, Super Admins)
  const moderators = await prisma.user.findMany({
    where: { level: { gte: 3 } },
    select: { id: true }
  });

  for (const mod of moderators) {
    await sendNotification({
      userId: mod.id,
      type: 'SYSTEM',
      title,
      content,
      relatedId
    }).catch(err => console.error('Failed to notify moderator', mod.id, err));
  }
};
`;
}

fs.writeFileSync(filePath, content);
console.log('Added notifyModerators helper');
