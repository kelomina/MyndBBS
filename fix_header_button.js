const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-muted-foreground hover:bg-accent/50 rounded-full transition-colors"
                title={dict.messages?.conversationSettings || "Settings"}
              >
                <Settings className="h-5 w-5" />
              </button>`;

const replacement = `              <button
                onClick={handleAddFriend}
                disabled={isAddingFriend || friendRequestSent}
                className="p-2 text-muted-foreground hover:bg-accent/50 rounded-full transition-colors disabled:opacity-50"
                title={friendRequestSent ? (dict.messages?.requestSent || "Request Sent") : (dict.messages?.addFriend || "Add Friend")}
              >
                {friendRequestSent ? <Check className="h-5 w-5 text-green-500" /> : <UserPlus className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-muted-foreground hover:bg-accent/50 rounded-full transition-colors"
                title={dict.messages?.conversationSettings || "Settings"}
              >
                <Settings className="h-5 w-5" />
              </button>`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Fixed header button');
