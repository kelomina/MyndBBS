const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const fetchStr = `        const inboxRes = await fetch(\`/api/v1/messages/inbox?withUserId=\${targetData.userId}\`, { credentials: 'include' });
        if (inboxRes.ok) {
          const inboxData = await inboxRes.json();
          setMessages(inboxData.messages);
          setNextCursor(inboxData.nextCursor || null);
          setHasMore(inboxData.hasMore || false);
          scrollToBottom();
          
          // Mark as read
          fetch('/api/v1/messages/read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ senderId: targetData.userId })
          }).catch(console.error);
        }`;

content = content.replace(
  /        const inboxRes = await fetch\(`\/api\/v1\/messages\/inbox\?withUserId=\$\{targetData\.userId\}`\, \{ credentials: 'include' \}\);\n        if \(inboxRes\.ok\) \{\n          const inboxData = await inboxRes\.json\(\);\n          setMessages\(inboxData\.messages\);\n          setNextCursor\(inboxData\.nextCursor \|\| null\);\n          setHasMore\(inboxData\.hasMore \|\| false\);\n          scrollToBottom\(\);\n        \}/,
  fetchStr
);

fs.writeFileSync(filePath, content);
console.log('Added markAsRead call');
