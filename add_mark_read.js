const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `          const inboxRes = await fetch(\`/api/v1/messages/inbox?withUserId=\${targetData.userId}\`, { credentials: 'include' });
          if (inboxRes.ok) {
            const inboxData = await inboxRes.json();
            setMessages(inboxData.messages);
            scrollToBottom();
          }`;

const replacement = `          const inboxRes = await fetch(\`/api/v1/messages/inbox?withUserId=\${targetData.userId}\`, { credentials: 'include' });
          if (inboxRes.ok) {
            const inboxData = await inboxRes.json();
            setMessages(inboxData.messages);
            scrollToBottom();
            
            // Mark messages as read
            fetch('/api/v1/messages/read', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ senderId: targetData.userId })
            }).then(() => {
              window.dispatchEvent(new Event('messages-read'));
            }).catch(console.error);
          }`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Added markAsRead API call when loading inbox messages');
