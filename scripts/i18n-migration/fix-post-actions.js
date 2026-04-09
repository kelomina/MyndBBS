const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'packages/frontend/src');

function injectUseTranslation(filePath, componentDeclaration) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('const dict = useTranslation()')) {
    content = content.replace(componentDeclaration, componentDeclaration + "\n  const dict = useTranslation();");
    fs.writeFileSync(filePath, content);
    console.log(`Injected useTranslation in ${filePath}`);
  }
}

injectUseTranslation(path.join(basePath, 'app/p/[id]/PostActions.tsx'), 'authorUsername\n}: {\n  postId: number;\n  initialUpvotes: number;\n  initialBookmarks: number;\n  authorUsername: string;\n}) {');
