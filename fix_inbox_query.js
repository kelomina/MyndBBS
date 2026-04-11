const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `    whereClause = {
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
    };`;

const replace1 = `    whereClause = {
      AND: [
        {
          OR: [
            { senderId: userId, receiverId: String(withUserId) },
            { senderId: String(withUserId), receiverId: userId }
          ]
        },
        notExpiredCondition
      ]
    };`;

const target2 = `  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition,
      { NOT: { deletedBy: { has: userId } } }
    ]
  };`;

const replace2 = `  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition
    ]
  };`;

content = content.replace(target1, replace1);
content = content.replace(target2, replace2);

// Filter deleted messages in memory as a fallback, or using Prisma's NOT array:
// Actually, Prisma might require { hasSome: [userId] } instead of has? No, has is for scalar value.
// Let's filter in memory for now to test if it fixes the issue.

fs.writeFileSync(filePath, content);
console.log('Removed NOT: { deletedBy: { has: userId } } from getInbox query');
