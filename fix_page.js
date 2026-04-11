const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace hardcoded text with dict values
content = content.replace(
  '<h3 className="font-semibold mb-3 text-sm">Conversation Settings</h3>',
  '<h3 className="font-semibold mb-3 text-sm">{dict.messages?.conversationSettings || "Conversation Settings"}</h3>'
);

content = content.replace(
  '<span className="text-sm">Allow Two-Sided Delete</span>',
  '<span className="text-sm">{dict.messages?.allowTwoSidedDelete || "Allow Two-Sided Delete"}</span>'
);

content = content.replace(
  'If enabled, when you delete a message, it will also be deleted for {username}.',
  '{dict.messages?.allowTwoSidedDeleteDesc?.replace("{username}", username) || `If enabled, when you delete a message, it will also be deleted for ${username}.`}'
);

content = content.replace(
  'title="Clear Chat"',
  'title={dict.messages?.clearChat || "Clear Chat"}'
);

content = content.replace(
  'title="Settings"',
  'title={dict.messages?.conversationSettings || "Settings"}'
);

content = content.replace(
  'title="Delete Message"',
  'title={dict.messages?.deleteMessage || "Delete Message"}'
);

content = content.replace(
  '<div className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2">\n                              Friend Request\n                            </div>',
  '<div className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2">\n                              {dict.messages?.friendRequest || "Friend Request"}\n                            </div>'
);

content = content.replace(
  '<div className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2">\n                            System Notification\n                          </div>',
  '<div className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2">\n                            {dict.messages?.systemNotification || "System Notification"}\n                          </div>'
);

content = content.replace(
  'Manage Friends',
  '{dict.messages?.manageFriends || "Manage Friends"}'
);

content = content.replace(
  '<button onClick={() => { onPreview(blobUrl); setShowMenu(false); }} className="px-3 py-2 text-sm hover:bg-accent rounded text-left">Full Screen</button>',
  '<button onClick={() => { onPreview(blobUrl); setShowMenu(false); }} className="px-3 py-2 text-sm hover:bg-accent rounded text-left">{dict.messages?.fullScreen || "Full Screen"}</button>'
);

content = content.replace(
  '<a href={blobUrl} download="secure_image" onClick={() => setShowMenu(false)} className="px-3 py-2 text-sm hover:bg-accent rounded text-left block">Download</a>',
  '<a href={blobUrl} download="secure_image" onClick={() => setShowMenu(false)} className="px-3 py-2 text-sm hover:bg-accent rounded text-left block">{dict.messages?.download || "Download"}</a>'
);

content = content.replace(
  '<button onClick={() => setShowMenu(false)} className="px-3 py-2 text-sm hover:bg-accent text-destructive rounded text-left">Cancel</button>',
  '<button onClick={() => setShowMenu(false)} className="px-3 py-2 text-sm hover:bg-accent text-destructive rounded text-left">{dict.common?.cancel || "Cancel"}</button>'
);

// Fix the select styling and localization
const selectStr = `<select 
                  value={expiresIn} 
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  className="text-xs bg-transparent border-none text-muted-foreground focus:ring-0 cursor-pointer"
                >
                  <option value={0}>No Expiration</option>
                  <option value={60000}>1 Minute</option>
                  <option value={3600000}>1 Hour</option>
                  <option value={86400000}>1 Day</option>
                  <option value={604800000}>1 Week</option>
                </select>`;

const selectReplacement = `<select 
                  value={expiresIn} 
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  className="text-xs bg-transparent border-none text-muted-foreground focus:ring-0 cursor-pointer outline-none"
                >
                  <option value={0} className="bg-background text-foreground">{dict.messages?.noExpiration || "No Expiration"}</option>
                  <option value={60000} className="bg-background text-foreground">{dict.messages?.oneMinute || "1 Minute"}</option>
                  <option value={3600000} className="bg-background text-foreground">{dict.messages?.oneHour || "1 Hour"}</option>
                  <option value={86400000} className="bg-background text-foreground">{dict.messages?.oneDay || "1 Day"}</option>
                  <option value={604800000} className="bg-background text-foreground">{dict.messages?.oneWeek || "1 Week"}</option>
                </select>`;

content = content.replace(selectStr, selectReplacement);

// Make sure dict is passed to EncryptedImage
if (!content.includes('const EncryptedImage = ({ payload, onPreview, dict }: { payload: string, onPreview: (url: string) => void, dict: any }) => {')) {
  content = content.replace(
    'const EncryptedImage = ({ payload, onPreview }: { payload: string, onPreview: (url: string) => void }) => {',
    'const EncryptedImage = ({ payload, onPreview, dict }: { payload: string, onPreview: (url: string) => void, dict: any }) => {'
  );
  content = content.replace(
    '<EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} />',
    '<EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} dict={dict} />'
  );
}

fs.writeFileSync(filePath, content);
console.log('Fixed page.tsx');
