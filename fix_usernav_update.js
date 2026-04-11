const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/components/layout/UserNav.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })`;

const replace = `  const fetchUnreadCount = () => {
    fetch('/api/v1/messages/unread', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setUnreadCount(d.count || 0))
      .catch(() => setUnreadCount(0));
  };

  useEffect(() => {
    const handleUnreadUpdate = () => fetchUnreadCount();
    window.addEventListener('messages-read', handleUnreadUpdate);
    window.addEventListener('messages-received', handleUnreadUpdate);

    return () => {
      window.removeEventListener('messages-read', handleUnreadUpdate);
      window.removeEventListener('messages-received', handleUnreadUpdate);
    };
  }, []);

  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })`;

content = content.replace(target, replace);

const target2 = `        // Fetch unread messages/notifications count
        fetch('/api/v1/messages/unread', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { count: 0 })
          .then(d => setUnreadCount(d.count || 0))
          .catch(() => setUnreadCount(0));`;

content = content.replace(target2, `        fetchUnreadCount();`);

fs.writeFileSync(filePath, content);
console.log('Fixed UserNav to listen to messages-read event');
