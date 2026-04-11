const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "const [error, setError] = useState('');",
  `const [error, setError] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);`
);

fs.writeFileSync(filePath, content);
console.log('Fixed states');
