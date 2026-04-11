const fs = require('fs');
const path = require('path');

const headerPath = path.join(__dirname, 'packages/frontend/src/components/layout/Header.tsx');
let headerContent = fs.readFileSync(headerPath, 'utf8');

headerContent = headerContent.replace("import { NotificationsDropdown } from '../NotificationsDropdown';\n", "");
headerContent = headerContent.replace("          <NotificationsDropdown />\n", "");

fs.writeFileSync(headerPath, headerContent);

const dropdownPath = path.join(__dirname, 'packages/frontend/src/components/NotificationsDropdown.tsx');
if (fs.existsSync(dropdownPath)) {
  fs.unlinkSync(dropdownPath);
}

console.log('Fixed Header and removed NotificationsDropdown');
