const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The file has conflict markers. Let's just rewrite the entire file since we know exactly what it should look like.
// Or we can just use `git checkout --ours` or `--theirs` and fix it? No, rewriting is safer.
