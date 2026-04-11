const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/p/[id]/PostActions.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("import { useToast } from '../../components/ui/Toast';", "import { useToast } from '../../../components/ui/Toast';");

fs.writeFileSync(filePath, content);
console.log('Fixed PostActions path');
