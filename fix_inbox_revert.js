const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition
    ]
  };`;

const replace1 = `  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition,
      { NOT: { deletedBy: { has: userId } } }
    ]
  };`;

const target2 = `    whereClause = {
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

const replace2 = `    whereClause = {
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

const target3 = `  const resultMessages = messages.filter((m: any) => !m.deletedBy?.includes(userId)).reverse();`;
const replace3 = `  const resultMessages = messages.reverse();`;

content = content.replace(target1, replace1);
content = content.replace(target2, replace2);
content = content.replace(target3, replace3);

fs.writeFileSync(filePath, content);
console.log('Reverted memory filter and restored DB filter');
