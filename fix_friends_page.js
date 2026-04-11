const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/friends/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  '<UserPlus className="h-6 w-6" /> Manage Friends',
  '<UserPlus className="h-6 w-6" /> {dict.messages?.manageFriends || "Manage Friends"}'
);

content = content.replace(
  '<h2 className="font-semibold mb-4">Add a Friend</h2>',
  '<h2 className="font-semibold mb-4">{dict.messages?.addFriend || "Add a Friend"}</h2>'
);

content = content.replace(
  'placeholder="Enter username to add"',
  'placeholder={dict.messages?.enterUsernameToAdd || "Enter username to add"}'
);

content = content.replace(
  'Send Request\n          </button>',
  '{dict.messages?.sendRequest || "Send Request"}\n          </button>'
);

content = content.replace(
  '<h2 className="font-semibold text-lg">Your Friends & Requests</h2>',
  '<h2 className="font-semibold text-lg">{dict.messages?.yourFriends || "Your Friends & Requests"}</h2>'
);

content = content.replace(
  '<p className="text-muted-foreground text-sm">No friends or pending requests yet.</p>',
  '<p className="text-muted-foreground text-sm">{dict.messages?.noFriendsYet || "No friends or pending requests yet."}</p>'
);

content = content.replace(
  '{f.status}',
  "{f.status === 'PENDING' ? (dict.messages?.pending || 'Pending') : f.status === 'ACCEPTED' ? (dict.messages?.accepted || 'Accepted') : (dict.messages?.rejected || 'Rejected')}"
);

content = content.replace(
  '<Check className="w-4 h-4"/> Accept',
  '<Check className="w-4 h-4"/> {dict.messages?.accept || "Accept"}'
);

content = content.replace(
  '<X className="w-4 h-4"/> Reject',
  '<X className="w-4 h-4"/> {dict.messages?.reject || "Reject"}'
);

content = content.replace(
  '>\n                      Chat\n                    </Link>',
  '>\n                      {dict.messages?.chat || "Chat"}\n                    </Link>'
);

fs.writeFileSync(filePath, content);
console.log('Fixed friends page.tsx');
