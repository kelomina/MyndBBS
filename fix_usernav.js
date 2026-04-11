const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/components/layout/UserNav.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add unreadCount state
if (!content.includes('unreadCount')) {
  content = content.replace(
    'const [loading, setLoading] = useState(true);',
    `const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);`
  );

  const fetchUnread = `
      .then(data => {
        setUser(data.user);
        // Fetch unread messages/notifications count
        fetch('/api/v1/messages/unread', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { count: 0 })
          .then(d => setUnreadCount(d.count || 0))
          .catch(() => setUnreadCount(0));
      })`;

  content = content.replace(
    /      \.then\(data => \{\n        setUser\(data\.user\);\n      \}\)/,
    fetchUnread
  );

  const mailIcon = `<Link
          href="/messages"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
          title={messagesText || 'Messages & Notifications'}
        >
          <Mail className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>`;

  content = content.replace(
    /<Link\n          href="\/messages"\n          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"\n          title=\{messagesText \|\| 'Messages'\}\n        >\n          <Mail className="h-5 w-5" \/>\n        <\/Link>/,
    mailIcon
  );
}

fs.writeFileSync(filePath, content);
console.log('Added unread count to UserNav');
