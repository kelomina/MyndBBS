const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          encryptedContent,
          expiresIn: expiresIn > 0 ? expiresIn : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { ...data.message, plaintext: inputText }]);
        setInputText('');
        scrollToBottom();
      } else {
        throw new Error('Failed to send message');
      }`;

const replace1 = `      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          encryptedContent,
          senderEncryptedContent,
          expiresIn: expiresIn > 0 ? expiresIn : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { ...data.message, plaintext: inputText }]);
        setInputText('');
        scrollToBottom();
      } else {
        const err = await res.json();
        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        }
        throw new Error(err.error || 'Failed to send message');
      }`;

content = content.replace(target1, replace1);

fs.writeFileSync(filePath, content);
console.log('Fixed handleSend');
