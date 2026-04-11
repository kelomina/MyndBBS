const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/components/layout/UserNav.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const fetchUnreadCount = () => {
    fetch('/api/v1/messages/unread', { credentials: 'include' })`;

const replacement = `  const fetchUnreadCount = () => {
    fetch('/api/v1/messages/unread?t=' + Date.now(), { credentials: 'include', cache: 'no-store' })`;

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content);
console.log('Fixed UserNav unread fetch cache');
