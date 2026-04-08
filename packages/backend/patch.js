const fs = require('fs');
const path = '/workspace/packages/backend/src/middleware/auth.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  "res.status(403).json({ error: 'Forbidden: Insufficient permissions' });",
  "console.log('Forbidden! user:', req.user, 'rules:', req.ability.rules); res.status(403).json({ error: 'Forbidden: Insufficient permissions' });"
);
fs.writeFileSync(path, code);
