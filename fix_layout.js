const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/layout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'import { PasskeyBanner } from "../components/PasskeyBanner";',
  'import { PasskeyBanner } from "../components/PasskeyBanner";\nimport { ToastProvider } from "../components/ui/Toast";'
);

content = content.replace(
  '<PasskeyBanner />',
  '<ToastProvider>\n            <PasskeyBanner />'
);

content = content.replace(
  '</TranslationProvider>',
  '  </ToastProvider>\n          </TranslationProvider>'
);

fs.writeFileSync(filePath, content);
console.log('Added ToastProvider to layout');
