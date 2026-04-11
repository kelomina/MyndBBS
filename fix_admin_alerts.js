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
  
  if (!content.includes('useToast')) {
    content = content.replace(
      "import { useEffect",
      "import { useToast } from '../../../../components/ui/Toast';\nimport { useEffect"
    );
    // for ModerationClient
    content = content.replace(
      "import { Plus",
      "import { useToast } from '../../../components/ui/Toast';\nimport { Plus"
    );
    // for categories/page
    content = content.replace(
      "import { Plus, Trash2",
      "import { useToast } from '../../../../components/ui/Toast';\nimport { Plus, Trash2"
    );

    // inject hook
    content = content.replace(
      "export default function AdminUsers() {",
      "export default function AdminUsers() {\n  const { toast } = useToast();"
    );
    content = content.replace(
      "export default function RecycleBin() {",
      "export default function RecycleBin() {\n  const { toast } = useToast();"
    );
    content = content.replace(
      "export function ModerationClient({ initialWords, dict }: ModerationClientProps) {",
      "export function ModerationClient({ initialWords, dict }: ModerationClientProps) {\n  const { toast } = useToast();"
    );
    content = content.replace(
      "export default function AdminCategories() {",
      "export default function AdminCategories() {\n  const { toast } = useToast();"
    );
  }

  content = content.replace(/alert\((.*?)\)/g, "toast($1, 'error')");
  
  fs.writeFileSync(filePath, content);
});

console.log('Fixed admin alerts');
