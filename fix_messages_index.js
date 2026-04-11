const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add UserPlus import
content = content.replace(
  "import { Shield, MessageSquare, Loader2, Search, Settings } from 'lucide-react';",
  "import { Shield, MessageSquare, Loader2, Search, Settings, UserPlus } from 'lucide-react';"
);
content = content.replace(
  "import { Shield, MessageSquare, Loader2, Search } from 'lucide-react';",
  "import { Shield, MessageSquare, Loader2, Search, UserPlus } from 'lucide-react';"
);

// Add Manage Friends button
const titleSection = `        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          {dict.messages.title}
        </h1>
        <Link 
          href="/friends"
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          {dict.messages?.manageFriends || "Manage Friends"}
        </Link>`;

content = content.replace(
  /<h1 className="text-3xl font-bold text-foreground flex items-center gap-3">\n          <MessageSquare className="h-8 w-8 text-primary" \/>\n          \{dict\.messages\.title\}\n        <\/h1>/,
  titleSection
);

fs.writeFileSync(filePath, content);
console.log('Added friends button to messages page');
