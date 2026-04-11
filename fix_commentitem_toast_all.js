const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/p/[id]/CommentItem.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "alert(dict.auth?.pleaseLogin || 'Please login to upvote.');",
  "toast(dict.auth?.pleaseLogin || 'Please login to upvote.', 'error');"
);

content = content.replace(
  "alert(dict.auth?.pleaseLogin || 'Please login to bookmark.');",
  "toast(dict.auth?.pleaseLogin || 'Please login to bookmark.', 'error');"
);

content = content.replace(
  "alert('Comment link copied to clipboard!');",
  "toast(dict.common?.linkCopied || 'Comment link copied to clipboard!', 'success');"
);

content = content.replace(
  "alert(error.message || dict.apiErrors?.ERR_FAILED_TO_UPDATE_COMMENT || 'Failed to update comment');",
  "toast(error.message || dict.apiErrors?.ERR_FAILED_TO_UPDATE_COMMENT || 'Failed to update comment', 'error');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed all CommentItem.tsx alerts');
