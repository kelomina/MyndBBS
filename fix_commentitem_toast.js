const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/p/[id]/CommentItem.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('useToast')) {
  content = content.replace(
    "import { formatDistanceToNow } from '../../../lib/utils';",
    "import { formatDistanceToNow } from '../../../lib/utils';\nimport { useToast } from '../../../components/ui/Toast';"
  );
  content = content.replace(
    "export function CommentItem({ comment, isAuthor, dict, onReply }: CommentItemProps) {",
    "export function CommentItem({ comment, isAuthor, dict, onReply }: CommentItemProps) {\n  const { toast } = useToast();"
  );
}

content = content.replace(
  "alert(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\");",
  "toast(dict.apiErrors?.ERR_PENDING_MODERATION || \"Your content contains moderated words and has been submitted for manual review.\", 'info');"
);

content = content.replace(
  "alert(err.message || dict.apiErrors?.ERR_FAILED_TO_UPDATE || 'Failed to update comment');",
  "toast(err.message || dict.apiErrors?.ERR_FAILED_TO_UPDATE || 'Failed to update comment', 'error');"
);

content = content.replace(
  "alert(dict.post?.deleteConfirm || 'Are you sure you want to delete this comment?');",
  "if (!confirm(dict.post?.deleteConfirm || 'Are you sure you want to delete this comment?')) return;"
);

content = content.replace(
  "alert(err.message || dict.apiErrors?.ERR_FAILED_TO_DELETE || 'Failed to delete comment');",
  "toast(err.message || dict.apiErrors?.ERR_FAILED_TO_DELETE || 'Failed to delete comment', 'error');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed CommentItem.tsx alerts');
