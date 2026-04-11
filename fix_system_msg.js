const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                        <div className="text-sm whitespace-pre-wrap break-words">
                          {msg.plaintext?.startsWith('{') && msg.plaintext.includes('"type":"image"') ? (
                            <EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} dict={dict} />
                          ) : (
                            msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>
                          )}
                        </div>`;

const replacement = `                        <div className="text-sm whitespace-pre-wrap break-words">
                          {msg.plaintext?.startsWith('{') && msg.plaintext.includes('"type":"image"') ? (
                            <EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} dict={dict} />
                          ) : msg.isSystem && msg.plaintext?.startsWith('{') ? (
                            (() => {
                              try {
                                const parsed = JSON.parse(msg.plaintext);
                                return (
                                  <div className="flex flex-col gap-1">
                                    <strong className="text-sm border-b border-border/50 pb-1 mb-1">{parsed.title}</strong>
                                    <span className="text-sm">{parsed.content}</span>
                                    {parsed.relatedId && parsed.type?.includes('POST') && (
                                      <Link href={\`/p/\${parsed.relatedId}\`} className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                                        {dict.messages?.viewPost || "View Post"} &rarr;
                                      </Link>
                                    )}
                                  </div>
                                );
                              } catch(e) {
                                return msg.plaintext;
                              }
                            })()
                          ) : (
                            msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>
                          )}
                        </div>`;

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content);
console.log('Fixed system message rendering');
