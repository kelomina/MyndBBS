const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add Lucide icon
content = content.replace(
  "Settings, Clock, Trash, Image as ImageIcon, X } from 'lucide-react';",
  "Settings, Clock, Trash, Image as ImageIcon, X, UserPlus, Check } from 'lucide-react';"
);

// Add states
content = content.replace(
  "const [error, setError] = useState<string | null>(null);",
  `const [error, setError] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);`
);

// Handle errors in handleImageUpload
const oldImgErr = `        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        }
        throw new Error(err.error || 'Failed to send image');`;

const newImgErr = `        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        } else if (err.error === 'ERR_MESSAGE_RATE_LIMIT_EXCEEDED') {
           throw new Error(dict.messages?.errRateLimit || '发送过于频繁，请稍后再试。');
        }
        throw new Error(err.error || 'Failed to send image');`;

content = content.replace(oldImgErr, newImgErr);

// Handle errors in handleSend
const oldSendErr = `        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        }
        throw new Error(err.error || 'Failed to send message');`;

const newSendErr = `        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        } else if (err.error === 'ERR_MESSAGE_RATE_LIMIT_EXCEEDED') {
           throw new Error(dict.messages?.errRateLimit || '发送过于频繁，请稍后再试。');
        }
        throw new Error(err.error || 'Failed to send message');`;

content = content.replace(oldSendErr, newSendErr);

// Add handleAddFriend method
const addFriendFn = `  const handleAddFriend = async () => {
    if (!targetUserId || isAddingFriend) return;
    setIsAddingFriend(true);
    try {
      const res = await fetch('/api/v1/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addresseeId: targetUserId })
      });
      if (res.ok) {
        setFriendRequestSent(true);
      } else {
        const err = await res.json();
        if (err.error === 'ERR_FRIENDSHIP_EXISTS') {
           setFriendRequestSent(true);
        } else {
           alert(err.error || 'Failed to send request');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleClearChat = async () => {`;

content = content.replace('  const handleClearChat = async () => {', addFriendFn);

// Add Add Friend button to header
const oldHeaderIcons = `<button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-muted-foreground hover:bg-accent/50 rounded-full transition-colors"
            title={dict.messages?.conversationSettings || "Settings"}
          >
            <Settings className="h-5 w-5" />
          </button>`;

const newHeaderIcons = `<button 
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

content = content.replace(oldHeaderIcons, newHeaderIcons);

// Replace error div with a component that includes the button if it's a friend limit error
const oldErrorDiv = `{error && (
        <div className="mb-6 shrink-0 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}`;

const newErrorDiv = `{error && (
        <div className="mb-6 shrink-0 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{error}</span>
          {(error === dict.messages?.errFriendLimit || error === '非好友最多发送 3 条消息，请先添加好友。') && (
             <button
                onClick={handleAddFriend}
                disabled={isAddingFriend || friendRequestSent}
                className="inline-flex items-center gap-2 whitespace-nowrap bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-medium text-xs hover:bg-destructive/90 transition-colors disabled:opacity-50"
             >
                {isAddingFriend ? <Loader2 className="h-4 w-4 animate-spin" /> : (friendRequestSent ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                {friendRequestSent ? (dict.messages?.requestSent || "Request Sent") : (dict.messages?.addFriend || "Add Friend")}
             </button>
          )}
        </div>
      )}`;

content = content.replace(oldErrorDiv, newErrorDiv);

fs.writeFileSync(filePath, content);
console.log('Fixed rate limit error display and added Add Friend buttons');
