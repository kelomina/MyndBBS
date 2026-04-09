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

// Update admin categories page
replaceInFile(path.join(basePath, 'app/admin/categories/page.tsx'), [
  ['title="Remove moderator"', 'title={dict.admin?.removeModerator || "Remove moderator"}'],
  ['title="Create Category"', 'title={dict.admin?.createCategory || "Create Category"}'],
  ['title="Assign Moderator"', 'title={dict.admin?.assignModerator || "Assign Moderator"}'],
  ['title="Confirm Deletion"', 'title={dict.admin?.confirmDeletion || "Confirm Deletion"}']
]);

// Update profile tabs
replaceInFile(path.join(basePath, 'app/u/[username]/ProfileTabs.tsx'), [
  ['title="Remove bookmark"', 'title={dict.profile?.removeBookmark || "Remove bookmark"}']
]);

// Inject useTranslation to CommentItem and PostActions if missing, and replace
function injectAndReplace(relPath, componentDeclaration, replacements) {
  const filePath = path.join(basePath, relPath);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('useTranslation')) {
    let depth = (filePath.match(/\//g) || []).length - (basePath.match(/\//g) || []).length;
    let importPath = '../'.repeat(depth - 1) + 'components/TranslationProvider';
    content = `import { useTranslation } from '${importPath}';\n` + content;
    content = content.replace(componentDeclaration, componentDeclaration + "\n  const dict = useTranslation();");
  }

  for (const [search, replace] of replacements) {
    if (typeof search === 'string') {
      content = content.split(search).join(replace);
    } else {
      content = content.replace(search, replace);
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${relPath}`);
}

injectAndReplace('app/p/[id]/CommentItem.tsx', 'export function CommentItem({ comment, postId, onReply }: CommentItemProps) {', [
  ['title="Edit Comment"', 'title={dict.post?.editComment || "Edit Comment"}'],
  ['title="Delete Comment"', 'title={dict.post?.deleteComment || "Delete Comment"}'],
  ['if (confirm(\'Are you sure you want to delete this comment? This action cannot be undone.\'))', 'if (confirm(dict.post?.confirmDeleteComment || \'Are you sure you want to delete this comment? This action cannot be undone.\'))']
]);

injectAndReplace('app/p/[id]/PostActions.tsx', 'export function PostActions({ post }: { post: Post }) {', [
  ['title="Edit Post"', 'title={dict.post?.editPost || "Edit Post"}'],
  ['title="Delete Post"', 'title={dict.post?.deletePost || "Delete Post"}'],
  ['if (confirm(\'Are you sure you want to delete this post? This action cannot be undone.\'))', 'if (confirm(dict.post?.confirmDeletePost || \'Are you sure you want to delete this post? This action cannot be undone.\'))']
]);
