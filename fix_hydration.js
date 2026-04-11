const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.plaintext?.startsWith('{') && msg.plaintext.includes('"type":"image"') ? (
                          <EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} dict={dict} />
                        ) : (
                          msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>
                        )}
                      </p>`;

const replacement = `                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.plaintext?.startsWith('{') && msg.plaintext.includes('"type":"image"') ? (
                          <EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} dict={dict} />
                        ) : (
                          msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>
                        )}
                      </div>`;

content = content.replace(target, replacement);

const targetContainer = `                  <div key={msg.id} className={\`flex \${isMine ? 'justify-end' : 'justify-start'} group\`}>`;
const replacementContainer = `                  <div key={msg.id} className={\`flex \${isMine ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300\`}>`;

content = content.replace(/                  <div key=\{msg\.id\} className=\{\`flex \$\{isMine \? 'justify-end' : 'justify-start'\} group\`\}>/g, replacementContainer);

fs.writeFileSync(filePath, content);
console.log('Fixed HTML hydration issue and added chat bubble animations');
