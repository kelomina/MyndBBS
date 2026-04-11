const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/p/[id]/CommentsSection.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('useToast')) {
  content = content.replace(
    "import { SliderCaptcha } from '../../../components/SliderCaptcha';",
    "import { SliderCaptcha } from '../../../components/SliderCaptcha';\nimport { useToast } from '../../../components/ui/Toast';"
  );
  content = content.replace(
    "export function CommentsSection({ postId, authorId, initialComments, dict }: { postId: string; authorId: string; initialComments: any[]; dict: any }) {",
    "export function CommentsSection({ postId, authorId, initialComments, dict }: { postId: string; authorId: string; initialComments: any[]; dict: any }) {\n  const { toast } = useToast();"
  );
}

content = content.replace(
  "alert(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\");",
  "toast(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\", 'info');"
);

content = content.replace(
  "alert(err.message || dict.apiErrors?.ERR_FAILED_TO_POST_COMMENT || 'Failed to post comment');",
  "toast(err.message || dict.apiErrors?.ERR_FAILED_TO_POST_COMMENT || 'Failed to post comment', 'error');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed CommentsSection.tsx alerts');
