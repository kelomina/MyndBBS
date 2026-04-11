const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldToggle = `<input 
                      type="checkbox" 
                      checked={allowTwoSidedDelete}
                      onChange={toggleTwoSidedDelete}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                      style={{ transform: allowTwoSidedDelete ? 'translateX(100%)' : 'translateX(0)', borderColor: allowTwoSidedDelete ? '#10b981' : '#e5e7eb' }}
                    />
                    <label className={\`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer \${allowTwoSidedDelete ? 'bg-green-500' : 'bg-gray-300'}\`}></label>`;

const newToggle = `<input 
                      type="checkbox" 
                      checked={allowTwoSidedDelete}
                      onChange={toggleTwoSidedDelete}
                      className={\`toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out \${allowTwoSidedDelete ? 'translate-x-full border-green-500' : 'translate-x-0 border-muted'}\`}
                    />
                    <label className={\`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer \${allowTwoSidedDelete ? 'bg-green-500' : 'bg-muted'}\`}></label>`;

content = content.replace(oldToggle, newToggle);

fs.writeFileSync(filePath, content);
console.log('Fixed toggle styling');
