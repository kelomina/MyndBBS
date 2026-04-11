const fs = require('fs');
const path = require('path');

function replaceAlerts(file, replaceFn) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('useToast')) {
    content = content.replace(
      "import { formatDistanceToNow } from '../../lib/utils';",
      "import { formatDistanceToNow } from '../../lib/utils';\nimport { useToast } from '../../components/ui/Toast';"
    );
    content = content.replace(
      "export function PostActions({ post, initialHasUpvoted, initialUpvotes, initialHasBookmarked, initialBookmarks, authorId, dict }: PostActionsProps) {",
      "export function PostActions({ post, initialHasUpvoted, initialUpvotes, initialHasBookmarked, initialBookmarks, authorId, dict }: PostActionsProps) {\n  const { toast } = useToast();"
    );
  }
  content = replaceFn(content);
  fs.writeFileSync(filePath, content);
}

replaceAlerts('packages/frontend/src/app/p/[id]/PostActions.tsx', (content) => {
  content = content.replace(
    "if (res.status === 401) alert('Please login to upvote.');",
    "if (res.status === 401) toast(dict.auth?.pleaseLogin || 'Please login to upvote.', 'error');"
  );
  content = content.replace(
    "if (res.status === 401) alert('Please login to bookmark.');",
    "if (res.status === 401) toast(dict.auth?.pleaseLogin || 'Please login to bookmark.', 'error');"
  );
  content = content.replace(
    "alert('Link copied to clipboard!');",
    "toast(dict.common?.linkCopied || 'Link copied to clipboard!', 'success');"
  );
  content = content.replace(
    "alert('Post deleted successfully');",
    "toast(dict.post?.postDeleted || 'Post deleted successfully', 'success');"
  );
  content = content.replace(
    "alert(data.error || 'Failed to delete post');",
    "toast(data.error || dict.apiErrors?.ERR_FAILED_TO_DELETE || 'Failed to delete post', 'error');"
  );
  content = content.replace(
    "alert('Failed to delete post');",
    "toast(dict.apiErrors?.ERR_FAILED_TO_DELETE || 'Failed to delete post', 'error');"
  );
  return content;
});

// For CommentsSection
let commentsSection = fs.readFileSync(path.join(__dirname, 'packages/frontend/src/app/p/[id]/CommentsSection.tsx'), 'utf8');
commentsSection = commentsSection.replace(
  "alert(err.message || dict.apiErrors?.ERR_FAILED_TO_DELETE_COMMENT || 'Failed to delete comment');",
  "toast(err.message || dict.apiErrors?.ERR_FAILED_TO_DELETE_COMMENT || 'Failed to delete comment', 'error');"
);
fs.writeFileSync(path.join(__dirname, 'packages/frontend/src/app/p/[id]/CommentsSection.tsx'), commentsSection);

// For messages/page.tsx
let msgPage = fs.readFileSync(path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx'), 'utf8');
if (!msgPage.includes('useToast')) {
    msgPage = msgPage.replace(
      "import { Shield, Loader2",
      "import { useToast } from '../../../../components/ui/Toast';\nimport { Shield, Loader2"
    );
    msgPage = msgPage.replace(
      "const [myId, setMyId] = useState('');",
      "const [myId, setMyId] = useState('');\n  const { toast } = useToast();"
    );
}
msgPage = msgPage.replace(
  "alert(err.error || 'Failed to send request');",
  "toast(err.error || dict.messages?.failedToSendRequest || 'Failed to send request', 'error');"
);
fs.writeFileSync(path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx'), msgPage);

console.log('Fixed additional alerts');
