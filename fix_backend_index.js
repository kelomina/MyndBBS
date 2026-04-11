const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/index.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("  const notificationRoutes = require('./routes/notification').default;\n", "");
content = content.replace("  app.use('/api/v1/notifications', notificationRoutes);\n", "");

fs.writeFileSync(filePath, content);
console.log('Removed notification routes from index.ts');
