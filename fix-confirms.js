const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'packages/frontend/src');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  for (const [search, replace] of replacements) {
    if (typeof search === 'string') {
      content = content.split(search).join(replace);
    } else {
      content = content.replace(search, replace);
    }
  }
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

replaceInFile(path.join(basePath, 'app/admin/categories/page.tsx'), [
  ["confirm('Are you sure you want to remove this moderator?')", "confirm(dict.admin?.confirmRemoveModerator || 'Are you sure you want to remove this moderator?')"]
]);

replaceInFile(path.join(basePath, 'app/p/[id]/CommentsSection.tsx'), [
  ["confirm('Are you sure you want to delete this comment?')", "confirm(dict.post?.confirmDeleteComment || 'Are you sure you want to delete this comment?')"]
]);

replaceInFile(path.join(basePath, 'app/p/[id]/PostActions.tsx'), [
  ["confirm('Are you sure you want to delete this post?')", "confirm(dict.post?.confirmDeletePost || 'Are you sure you want to delete this post?')"]
]);
