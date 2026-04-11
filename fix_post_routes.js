const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/routes/post.ts');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('notifyModerators')) {
  content = content.replace(
    "import { containsModeratedWord } from '../lib/moderation';",
    "import { containsModeratedWord } from '../lib/moderation';\nimport { notifyModerators } from '../lib/notification';"
  );
}

content = content.replace(
  `      if (isModerated) {
        res.status(201).json({ message: 'ERR_PENDING_MODERATION', post });
        return;
      }`,
  `      if (isModerated) {
        await notifyModerators('New Post Needs Moderation', \`A new post "\${post.title}" requires moderation.\`, post.id);
        res.status(201).json({ message: 'ERR_PENDING_MODERATION', post });
        return;
      }`
);

content = content.replace(
  `      if (isModerated) {
        res.json({ message: 'ERR_PENDING_MODERATION', post: updatedPost });
        return;
      }`,
  `      if (isModerated) {
        await notifyModerators('Post Needs Moderation', \`An edited post "\${updatedPost.title}" requires moderation.\`, updatedPost.id);
        res.json({ message: 'ERR_PENDING_MODERATION', post: updatedPost });
        return;
      }`
);

fs.writeFileSync(filePath, content);
console.log('Added notifyModerators to post creation and edit');
