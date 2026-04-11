const fs = require('fs');
const path = require('path');

const filesToFix = [
  'packages/frontend/src/app/admin/users/page.tsx',
  'packages/frontend/src/app/admin/recycle/page.tsx',
  'packages/frontend/src/app/admin/moderation/ModerationClient.tsx',
  'packages/frontend/src/app/admin/categories/page.tsx'
];

filesToFix.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/import \{ useToast \} from '\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/Toast';/g, "import { useToast } from '../../../components/ui/Toast';");
  fs.writeFileSync(filePath, content);
});

console.log('Fixed admin toast paths');
