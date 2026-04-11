const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add new icons
content = content.replace(
  "import { Shield, Loader2, Send, Lock, ArrowLeft } from 'lucide-react';",
  "import { Shield, Loader2, Send, Lock, ArrowLeft, Trash2, Settings, Clock, Trash } from 'lucide-react';"
);

// 2. Add state for Phase 3
const stateStr = `  const [unlocked, setUnlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Phase 3 States
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [allowTwoSidedDelete, setAllowTwoSidedDelete] = useState(false);
  const [showSettings, setShowSettings] = useState(false);`;

content = content.replace(
  `  const [unlocked, setUnlocked] = useState(false);\n  const messagesEndRef = useRef<HTMLDivElement>(null);`,
  stateStr
);

// 3. Fetch settings on load
const loadDataStr = `        // Load messages history
        const inboxRes = await fetch(\`/api/v1/messages/inbox?withUserId=\${targetData.userId}\`, { credentials: 'include' });
        if (inboxRes.ok) {
          const inboxData = await inboxRes.json();
          setMessages(inboxData.messages);
          scrollToBottom();
        }

        // Load conversation settings
        const settingsRes = await fetch(\`/api/v1/messages/settings/\${targetData.userId}\`, { credentials: 'include' });
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setAllowTwoSidedDelete(settingsData.allowTwoSidedDelete);
        }`;

content = content.replace(
  /        \/\/ Load messages history[\s\S]*?scrollToBottom\(\);\n        \}/,
  loadDataStr
);

// 4. Fix infinite render loop in decryptAllMessages
const decryptStr = `  const decryptAllMessages = async () => {
    let needsUpdate = false;
    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      if (msg.plaintext) return msg; // Already decrypted
      needsUpdate = true;
      try {
        if (msg.senderId === myUserId) {
          return { ...msg, plaintext: '[Sent Encrypted Message]' };
        } else {
          const ephemeralPublicKey = await importPublicKeyFromBase64(msg.ephemeralPublicKey);
          const decrypted = await decryptMessage(msg.encryptedContent, myPrivateKey!, ephemeralPublicKey);
          return { ...msg, plaintext: decrypted };
        }
      } catch (err) {
        console.error('Failed to decrypt message', msg.id, err);
        return { ...msg, plaintext: '[Decryption Failed]' };
      }
    }));
    
    if (needsUpdate) {
      setMessages(updatedMessages);
      scrollToBottom();
    }
  };`;

content = content.replace(
  /  const decryptAllMessages = async \(\) => \{[\s\S]*?scrollToBottom\(\);\n  \};/,
  decryptStr
);

// 5. Update handleSend to include expiresIn
const sendStr = `      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          encryptedContent,
          expiresIn: expiresIn > 0 ? expiresIn : undefined
        })
      });`;

content = content.replace(
  /      const res = await fetch\('\/api\/v1\/messages', \{[\s\S]*?\}\);/,
  sendStr
);

// 6. Add API calls for Phase 3
const apiCallsStr = `  const toggleTwoSidedDelete = async () => {
    try {
      const newValue = !allowTwoSidedDelete;
      await fetch(\`/api/v1/messages/settings/\${targetUserId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ allowTwoSidedDelete: newValue })
      });
      setAllowTwoSidedDelete(newValue);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(\`/api/v1/messages/\${msgId}\`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearChat = async () => {
    if (!confirm(dict.messages?.confirmClearChat || 'Are you sure you want to clear this chat?')) return;
    try {
      const res = await fetch(\`/api/v1/messages/chat/\${targetUserId}\`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {`;

content = content.replace(/  if \(loading\) \{/, apiCallsStr);

// 7. Add Settings and Clear Chat to Header
const headerStr = `      <div className="flex items-center gap-4 mb-6 shrink-0">
        <Link href="/messages" className="p-2 rounded-full hover:bg-accent/50 text-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold uppercase shrink-0">
          {username.charAt(0)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            {dict.messages.conversationWith?.replace('{username}', username) || \`Conversation with \${username}\`}
          </h1>
          <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <Lock className="h-3 w-3" /> E2E Encrypted
          </div>
        </div>
        
        {unlocked && (
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={handleClearChat}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
              title="Clear Chat"
            >
              <Trash className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-muted-foreground hover:bg-accent/50 rounded-full transition-colors"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>

            {showSettings && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg p-4 z-50">
                <h3 className="font-semibold mb-3 text-sm">Conversation Settings</h3>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Allow Two-Sided Delete</span>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      checked={allowTwoSidedDelete}
                      onChange={toggleTwoSidedDelete}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                      style={{ transform: allowTwoSidedDelete ? 'translateX(100%)' : 'translateX(0)', borderColor: allowTwoSidedDelete ? '#10b981' : '#e5e7eb' }}
                    />
                    <label className={\`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer \${allowTwoSidedDelete ? 'bg-green-500' : 'bg-gray-300'}\`}></label>
                  </div>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  If enabled, when you delete a message, it will also be deleted for {username}.
                </p>
              </div>
            )}
          </div>
        )}
      </div>`;

content = content.replace(
  /<div className="flex items-center gap-4 mb-6 shrink-0">[\s\S]*?<\/div>\n      <\/div>/,
  headerStr
);

// 8. Add Delete button to messages
const messageStr = `                return (
                  <div key={msg.id} className={\`flex \${isMine ? 'justify-end' : 'justify-start'} group\`}>
                    <div className={\`relative max-w-[75%] rounded-2xl px-4 py-2 \${
                      isMine 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }\`}>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>}
                      </p>
                      <p className={\`text-[10px] mt-1 \${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}\`}>
                        {new Date(msg.createdAt).toLocaleTimeString()} {new Date(msg.createdAt).toLocaleDateString()}
                      </p>
                      
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className={\`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity \${
                          isMine ? '-left-10' : '-right-10'
                        }\`}
                        title="Delete Message"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );`;

content = content.replace(
  /                return \(\n                  <div key=\{msg\.id\} className=\{`flex \$\{isMine \? 'justify-end' : 'justify-start'\}`\}>[\s\S]*?<\/div>\n                  <\/div>\n                \);/,
  messageStr
);

// 9. Add Expiration selector to input area
const inputAreaStr = `          <div className="p-4 border-t border-border bg-background/50 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <select 
                value={expiresIn} 
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                className="text-xs bg-transparent border-none text-muted-foreground focus:ring-0 cursor-pointer"
              >
                <option value={0}>No Expiration</option>
                <option value={60000}>1 Minute</option>
                <option value={3600000}>1 Hour</option>
                <option value={86400000}>1 Day</option>
                <option value={604800000}>1 Week</option>
              </select>
            </div>
            <form onSubmit={handleSend} className="flex gap-2">`;

content = content.replace(
  /          <div className="p-4 border-t border-border bg-background\/50">\n            <form onSubmit=\{handleSend\} className="flex gap-2">/,
  inputAreaStr
);

fs.writeFileSync(filePath, content);
console.log('Frontend updated for Phase 3!');
