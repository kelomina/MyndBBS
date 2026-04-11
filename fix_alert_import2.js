const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "Trash, Image as ImageIcon, X, UserPlus, Check } from 'lucide-react';",
  "Trash, Image as ImageIcon, X, UserPlus, Check, AlertCircle } from 'lucide-react';"
);

fs.writeFileSync(filePath, content);
