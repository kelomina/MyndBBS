const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "import { Shield, Loader2, MessageSquare, Plus } from 'lucide-react';",
  "import { Shield, Loader2, MessageSquare, Plus, UserPlus } from 'lucide-react';"
);

fs.writeFileSync(filePath, content);
console.log('Fixed import in page.tsx');
