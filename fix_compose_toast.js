const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/compose/ComposeForm.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('useToast')) {
  content = content.replace(
    "import { useTranslation } from '../../components/TranslationProvider';",
    "import { useTranslation } from '../../components/TranslationProvider';\nimport { useToast } from '../../components/ui/Toast';"
  );
  content = content.replace(
    "export function ComposeForm({ dict }: { dict: any }) {",
    "export function ComposeForm({ dict }: { dict: any }) {\n  const { toast } = useToast();"
  );
}

content = content.replace(
  "alert('Please fill out all fields');",
  "toast(dict.apiErrors?.ERR_PLEASE_FILL_ALL || 'Please fill out all fields', 'error');"
);

content = content.replace(
  "alert(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\");",
  "toast(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\", 'info');"
);

content = content.replace(
  "alert(err.message || dict.apiErrors?.ERR_FAILED_TO_PUBLISH || 'Failed to publish post');",
  "toast(err.message || dict.apiErrors?.ERR_FAILED_TO_PUBLISH || 'Failed to publish post', 'error');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed ComposeForm.tsx alerts');
