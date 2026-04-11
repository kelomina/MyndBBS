const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/next.config.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("      },\n      },", "      },");

fs.writeFileSync(filePath, content);
