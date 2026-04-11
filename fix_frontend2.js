const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix imports
content = content.replace(
  "import { Shield, Loader2, Send, Lock, ArrowLeft, Flame } from 'lucide-react';",
  "import { Shield, Loader2, Send, Lock, ArrowLeft, Flame, Trash2, Settings, Clock, Trash } from 'lucide-react';"
);

// 2. Add State for Phase 3
if (!content.includes('const [expiresIn')) {
  content = content.replace(
    "const [isLoadingOlder, setIsLoadingOlder] = useState(false);",
    "const [isLoadingOlder, setIsLoadingOlder] = useState(false);\n\n  // Phase 3 States\n  const [expiresIn, setExpiresIn] = useState<number>(0);\n  const [allowTwoSidedDelete, setAllowTwoSidedDelete] = useState(false);\n  const [showSettings, setShowSettings] = useState(false);"
  );
}

// 3. Load settings in loadInitialData
if (!content.includes('api/v1/messages/settings')) {
  content = content.replace(
    "setHasMore(inboxData.hasMore || false);\n          scrollToBottom();\n        }",
    "setHasMore(inboxData.hasMore || false);\n          scrollToBottom();\n        }\n\n        // Load conversation settings\n        const settingsRes = await fetch(`/api/v1/messages/settings/${targetData.userId}`, { credentials: 'include' });\n        if (settingsRes.ok) {\n          const settingsData = await settingsRes.json();\n          setAllowTwoSidedDelete(settingsData.allowTwoSidedDelete);\n        }"
  );
}

// 4. Update decryptAllMessages to fix infinite render loop
content = content.replace(
  /const decryptAllMessages = async \(\) => \{[\s\S]*?setMessages\(updatedMessages\);\n    scrollToBottom\(\);\n  \};/m,
  `const decryptAllMessages = async () => {
    let needsUpdate = false;
    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      if (msg.plaintext) return msg; // Already decrypted
      needsUpdate = true;
      try {
        if (msg.senderId === myUserId) {
          if (msg.senderEncryptedContent && myPrivateKey) {
             const ephemeralPublicKey = await importPublicKeyFromBase64(msg.ephemeralPublicKey);
             const decrypted = await decryptMessage(msg.senderEncryptedContent, myPrivateKey, ephemeralPublicKey);
             return { ...msg, plaintext: decrypted };
          }
          return { ...msg, plaintext: '[阅后即焚消息 / Burn-after-reading message]' };
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
  };`
);

// 5. Add APIs for Phase 3
if (!content.includes('toggleTwoSidedDelete')) {
  content = content.replace(
    "const handleSend = async",
    `const toggleTwoSidedDelete = async () => {
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

  const handleSend = async`
  );
}

// 6. Add expiresIn to send
content = content.replace(
  "encryptedContent\n        })",
  "encryptedContent,\n          expiresIn: expiresIn > 0 ? expiresIn : undefined\n        })"
);

// 7. Add Settings and Clear Chat to Header
content = content.replace(
  /        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">\n          <Lock className="h-3 w-3" \/> E2E Encrypted\n        <\/div>\n      <\/div>/m,
  `        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
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
    </div>`
);
content = content.replace(
  '<div className="flex items-center gap-4 mb-6 shrink-0">',
  '<div className="flex items-center justify-between mb-6 shrink-0"><div className="flex items-center gap-4">'
);

// 8. Add Delete button to messages
content = content.replace(
  /<p className=\{`text-\[10px\] mt-1 \$\{isMine \? 'text-primary-foreground\/70' : 'text-muted-foreground'\}`\}>\n                        \{new Date\(msg\.createdAt\)\.toLocaleTimeString\(\)\} \{new Date\(msg\.createdAt\)\.toLocaleDateString\(\)\}\n                      <\/p>\n                    <\/div>\n                  <\/div>/g,
  `<p className={\`text-[10px] mt-1 \${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}\`}>
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
                  </div>`
);

content = content.replace(
  /className=\{`flex \$\{isMine \? 'justify-end' : 'justify-start'\}`\}/g,
  `className={\`flex \${isMine ? 'justify-end' : 'justify-start'} group\`}`
);

content = content.replace(
  /className=\{`max-w-\[75%\] rounded-2xl px-4 py-2/g,
  `className={\`relative max-w-[75%] rounded-2xl px-4 py-2`
);

// 9. Add Expiration selector to input area
if (!content.includes('<Clock className="h-4 w-4')) {
  content = content.replace(
    '<div className="flex items-center justify-between mb-2">',
    `<div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
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
              </div>`
  );
}

fs.writeFileSync(filePath, content);
console.log('Frontend updated for Phase 3 on top of User code!');
