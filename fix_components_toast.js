const fs = require('fs');
const path = require('path');

function fixComponent(file, componentLinePattern) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('const { toast } = useToast();')) {
      // Find the start of the component body
      // We know it's a function that takes props
      const regex = new RegExp(`(${componentLinePattern}[^{]*\\{)`);
      content = content.replace(regex, `$1\n  const { toast } = useToast();`);
      
      // Ensure useToast is imported
      if (!content.includes('import { useToast }')) {
          content = content.replace(
              "import React",
              "import { useToast } from '../../../components/ui/Toast';\nimport React"
          );
      }

      fs.writeFileSync(filePath, content);
      console.log(`Fixed ${file}`);
  }
}

fixComponent('packages/frontend/src/app/p/[id]/CommentItem.tsx', 'export function CommentItem');
fixComponent('packages/frontend/src/app/p/[id]/CommentsSection.tsx', 'export function CommentsSection');
fixComponent('packages/frontend/src/app/p/[id]/PostActions.tsx', 'export function PostActions');

