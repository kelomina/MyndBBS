const fs = require('fs');
const path = require('path');

function fix(file, orig) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix CommentsSection
  if (file.includes('CommentsSection')) {
      content = content.replace(
          "export function CommentsSection({\n  const { toast } = useToast(); postId, dict, initialCount }: { postId: string, dict: any, initialCount: number }) {",
          "export function CommentsSection({ postId, dict, initialCount }: { postId: string, dict: any, initialCount: number }) {\n  const { toast } = useToast();"
      );
  }
  
  // Fix CommentItem
  if (file.includes('CommentItem')) {
      content = content.replace(
          "export function CommentItem({\n  const { toast } = useToast();\n  comment,\n  dict,",
          "export function CommentItem({\n  comment,\n  dict,\n  isAuthor,\n  onReply,\n  onUpdate,\n  onDelete,\n}: CommentItemProps) {\n  const { toast } = useToast();"
      );
      // Let's just be sure it's clean
      content = content.replace(/export function CommentItem\(\{\n  const \{ toast \} = useToast\(\);[\s\S]*?CommentItemProps\) \{/, "export function CommentItem({\n  comment,\n  dict,\n  isAuthor,\n  onReply,\n  onUpdate,\n  onDelete,\n}: CommentItemProps) {\n  const { toast } = useToast();");
  }

  // Fix PostActions
  if (file.includes('PostActions')) {
      content = content.replace(/export function PostActions\(\{\n  const \{ toast \} = useToast\(\);[\s\S]*?PostActionsProps\) \{/, "export function PostActions({\n  post,\n  initialHasUpvoted,\n  initialUpvotes,\n  initialHasBookmarked,\n  initialBookmarks,\n  authorId,\n  dict,\n}: PostActionsProps) {\n  const { toast } = useToast();");
  }

  fs.writeFileSync(filePath, content);
}

fix('packages/frontend/src/app/p/[id]/CommentsSection.tsx');
fix('packages/frontend/src/app/p/[id]/CommentItem.tsx');
fix('packages/frontend/src/app/p/[id]/PostActions.tsx');

console.log('Fixed syntax issues');
