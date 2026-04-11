const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/scripts/fix-db.ts');
if (!fs.existsSync(path.dirname(filePath))) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const content = `import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing existing private messages with NULL deletedBy...');
  try {
    const res = await prisma.$executeRaw\`UPDATE "PrivateMessage" SET "deletedBy" = ARRAY[]::text[] WHERE "deletedBy" IS NULL\`;
    console.log(\`Fixed \${res} messages.\`);
  } catch (e) {
    console.error('Failed to run fix-db script. Your database might be fine or using a different dialect.', e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
`;

fs.writeFileSync(filePath, content);
console.log('Created fix-db.ts script');

const pkgPath = path.join(__dirname, 'packages/backend/package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts['fix-db'] = 'ts-node scripts/fix-db.ts';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('Added fix-db to package.json');
