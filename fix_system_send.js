const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetSend = `const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !unlocked || !myPrivateKey || !theirPublicKey || isCoolingDown) return;`;

const replaceSend = `const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !unlocked || !myPrivateKey || !theirPublicKey || isCoolingDown) return;
    if (username === 'system') {
      setError(dict.messages?.cannotReplySystem || 'You cannot reply to system notifications.');
      return;
    }`;

content = content.replace(targetSend, replaceSend);

const targetImg = `const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !unlocked || !myPrivateKey || !theirPublicKey) return;`;

const replaceImg = `const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !unlocked || !myPrivateKey || !theirPublicKey) return;
    if (username === 'system') {
      setError(dict.messages?.cannotReplySystem || 'You cannot reply to system notifications.');
      return;
    }`;

content = content.replace(targetImg, replaceImg);

fs.writeFileSync(filePath, content);
console.log('Fixed sending to system');
