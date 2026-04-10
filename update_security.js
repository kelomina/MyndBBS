const fs = require('fs');

let content = fs.readFileSync('packages/frontend/src/components/SecuritySettings.tsx', 'utf8');

content = content.replace("import { useTranslation } from './TranslationProvider';", "import { useTranslation } from './TranslationProvider';\nimport { ReauthModal } from './ReauthModal';");

content = content.replace("const [showTotpSetup, setShowTotpSetup] = useState(false);", "const [showTotpSetup, setShowTotpSetup] = useState(false);\n  const [showReauth, setShowReauth] = useState(false);\n  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);");

const executeWithSudo = `const executeWithSudo = async (action: () => void) => {
    try {
      const res = await fetch('/api/v1/user/sudo/check', { credentials: 'include' });
      const data = await res.json();
      if (data.isSudo) {
        action();
      } else {
        setPendingAction(() => action);
        setShowReauth(true);
      }
    } catch (err) {
      setError('Network error');
    }
  };`;

const regex = /const fetchSecurityData = async \(\) => \{[\s\S]*?\} finally \{\s*setLoading\(false\);\s*\}\s*\};/;
content = content.replace(regex, "$&\n\n  " + executeWithSudo);

// Wrap buttons in executeWithSudo
content = content.replace("onClick={() => handleDeletePasskey(pk.id)}", "onClick={() => executeWithSudo(() => handleDeletePasskey(pk.id))}");
content = content.replace("onClick={handleAddPasskey}", "onClick={() => executeWithSudo(handleAddPasskey)}");
content = content.replace("onClick={handleDisableTotp}", "onClick={() => executeWithSudo(handleDisableTotp)}");
content = content.replace("onClick={() => setShowTotpSetup(true)}", "onClick={() => executeWithSudo(() => setShowTotpSetup(true))}");

// Add ReauthModal to return
content = content.replace("return (", "return (\n    <>\n      <ReauthModal isOpen={
