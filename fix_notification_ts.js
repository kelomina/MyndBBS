const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/lib/notification.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  for (const mod of moderators) {
    await sendNotification({
      userId: mod.id,
      type: 'SYSTEM',
      title,
      content,
      relatedId
    }).catch(err => console.error('Failed to notify moderator', mod.id, err));
  }`;

const replacement = `  for (const mod of moderators) {
    await sendNotification({
      userId: mod.id,
      type: 'SYSTEM',
      title,
      content,
      ...(relatedId ? { relatedId } : {})
    }).catch(err => console.error('Failed to notify moderator', mod.id, err));
  }`;

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content);
console.log('Fixed relatedId typing issue in notification.ts');
