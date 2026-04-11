const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/friends/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add useToast
content = content.replace(
  "import { useTranslation } from '../../components/TranslationProvider';",
  "import { useTranslation } from '../../components/TranslationProvider';\nimport { useToast } from '../../components/ui/Toast';"
);

content = content.replace(
  "const [myId, setMyId] = useState('');",
  "const [myId, setMyId] = useState('');\n  const { toast } = useToast();"
);

// Replace alerts
content = content.replace(
  "if (!uRes.ok) return alert('User not found or has not initialized messaging.');",
  "if (!uRes.ok) return toast(dict.messages?.userNotFound || 'User not found or has not initialized messaging.', 'error');"
);

content = content.replace(
  "alert('Friend request sent!');",
  "toast(dict.messages?.requestSent || 'Friend request sent!', 'success');"
);

content = content.replace(
  "alert(err.error || 'Failed to send request');",
  "toast(err.error || dict.messages?.failedToSendRequest || 'Failed to send request', 'error');"
);

content = content.replace(
  "alert('Error sending request');",
  "toast(dict.messages?.errorSendingRequest || 'Error sending request', 'error');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed alerts in friends page');
