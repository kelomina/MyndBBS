const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/routes/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox } from '../controllers/message';",
  "import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox, getUnreadCount, markAsRead, deleteMessage, clearChat, getConversationSettings, updateConversationSettings } from '../controllers/message';"
);

const routes = `
router.get('/unread', requireAuth, getUnreadCount);
router.put('/read', requireAuth, markAsRead);
router.get('/settings/:partnerId', requireAuth, getConversationSettings);
router.put('/settings/:partnerId', requireAuth, updateConversationSettings);
router.delete('/:id', requireAuth, deleteMessage);
router.delete('/chat/:withUserId', requireAuth, clearChat);
export default router;`;

content = content.replace(
  "export default router;",
  routes
);

fs.writeFileSync(filePath, content);
console.log('Fixed routes/message.ts');
