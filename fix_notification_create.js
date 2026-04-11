const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/lib/notification.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `        ephemeralPublicKey: 'system',
        encryptedContent: JSON.stringify(payload),
        isSystem: true
      }
    });`;

const replacement = `        ephemeralPublicKey: 'system',
        encryptedContent: JSON.stringify(payload),
        isSystem: true,
        deletedBy: []
      }
    });`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Fixed system notification create to include deletedBy: []');
