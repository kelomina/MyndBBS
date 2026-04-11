const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/p/[id]/edit/EditPostForm.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('useToast')) {
  content = content.replace(
    "import { PostEditor } from '../../../../components/PostEditor';",
    "import { PostEditor } from '../../../../components/PostEditor';\nimport { useToast } from '../../../../components/ui/Toast';"
  );
  content = content.replace(
    "export function EditPostForm({ dict, initialPost }: { dict: any, initialPost: any }) {",
    "export function EditPostForm({ dict, initialPost }: { dict: any, initialPost: any }) {\n  const { toast } = useToast();"
  );
}

content = content.replace(
  "alert(dict.common?.pleaseFillAllFields || 'Please fill out all fields');",
  "toast(dict.common?.pleaseFillAllFields || 'Please fill out all fields', 'error');"
);

content = content.replace(
  "alert(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\");",
  "toast(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\", 'info');"
);

content = content.replace(
  "alert(err.message || dict.apiErrors?.ERR_FAILED_TO_UPDATE || 'Failed to update post');",
  "toast(err.message || dict.apiErrors?.ERR_FAILED_TO_UPDATE || 'Failed to update post', 'error');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed EditPostForm.tsx alerts');
