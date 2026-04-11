const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `          // Mark as read
          fetch('/api/v1/messages/read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ senderId: targetData.userId })
          }).catch(console.error);`;

const replace = `          // Mark as read
          fetch('/api/v1/messages/read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ senderId: targetData.userId })
          }).then(() => {
             window.dispatchEvent(new Event('messages-read'));
          }).catch(console.error);`;

content = content.replace(target, replace);
fs.writeFileSync(filePath, content);
console.log('Fired messages-read event from chat page');
