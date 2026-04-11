const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldKeyFn = `export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.params.username as string;
  const user = await prisma.user.findUnique({ where: { username }, include: { userKey: true } });

  if (!user || !user.userKey) { res.status(404).json({ error: 'ERR_USER_OR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};`;

const newKeyFn = `export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.params.username as string;
  const user = await prisma.user.findUnique({ where: { username }, include: { userKey: true } });

  if (!user) { res.status(404).json({ error: 'ERR_USER_NOT_FOUND' }); return; }
  if (user.username === 'system') {
    res.json({ publicKey: 'system', userId: user.id });
    return;
  }
  if (!user.userKey) { res.status(404).json({ error: 'ERR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};`;

content = content.replace(oldKeyFn, newKeyFn);
fs.writeFileSync(filePath, content);
console.log('Mocked system public key');
