import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient, UserStatus } from '@prisma/client';

const router: import('express').Router = Router();
const envPath = path.resolve(__dirname, '../../.env');

// Temporary in-memory token for the install session
let installToken = '';

router.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>MyndBBS Installation</title>
      <style>
        body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px; background: #f9fafb; }
        .card { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #111827; }
        label { display: block; margin-top: 12px; font-weight: bold; font-size: 14px; }
        input { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #d1d5db; border-radius: 4px; box-sizing: border-box; }
        button { margin-top: 20px; background: #2563eb; color: white; padding: 10px 16px; border: none; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold; }
        button:hover { background: #1d4ed8; }
        .hidden { display: none; }
        .error { color: #dc2626; margin-top: 12px; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1>MyndBBS Setup</h1>
      
      <div id="step1" class="card">
        <h2>Step 1: Environment Configuration</h2>
        <form id="envForm">
          <label>Database URL (PostgreSQL)</label>
          <input type="text" id="dbUrl" placeholder="postgresql://user:pass@localhost:5432/mydb?schema=public" required>
          
          <label>Port</label>
          <input type="number" id="port" value="3001" required>
          
          <label>Frontend URL</label>
          <input type="url" id="frontendUrl" value="http://localhost:3000" required>
          
          <label>Upload Directory Path</label>
          <input type="text" id="uploadDir" value="./uploads" required>
          
          <label>Website Root Directory</label>
          <input type="text" id="webRoot" value="/" required>
          
          <button type="submit">Save & Initialize Database</button>
          <div id="envError" class="error"></div>
        </form>
      </div>

      <div id="step2" class="card hidden">
        <h2>Step 2: Admin Account Setup</h2>
        <p style="font-size: 14px; color: #4b5563;">A temporary root account has been created for this setup phase.</p>
        <form id="adminForm">
          <label>Admin Username</label>
          <input type="text" id="adminUser" required>
          
          <label>Admin Email</label>
          <input type="email" id="adminEmail" required>
          
          <label>Admin Password</label>
          <input type="password" id="adminPass" required>
          
          <button type="submit">Create Admin & Finish</button>
          <div id="adminError" class="error"></div>
        </form>
      </div>

      <script>
        let token = '';

        document.getElementById('envForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = e.target.querySelector('button');
          btn.textContent = 'Initializing... Please wait';
          btn.disabled = true;
          document.getElementById('envError').textContent = '';

          const payload = {
            DATABASE_URL: document.getElementById('dbUrl').value,
            PORT: document.getElementById('port').value,
            FRONTEND_URL: document.getElementById('frontendUrl').value,
            UPLOAD_DIR: document.getElementById('uploadDir').value,
            WEB_ROOT: document.getElementById('webRoot').value
          };

          try {
            const res = await fetch('/install/api/env', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
              token = data.token;
              document.getElementById('step1').classList.add('hidden');
              document.getElementById('step2').classList.remove('hidden');
            } else {
              document.getElementById('envError').textContent = data.error || 'Failed to initialize';
              btn.textContent = 'Save & Initialize Database';
              btn.disabled = false;
            }
          } catch (err) {
            document.getElementById('envError').textContent = err.message;
            btn.textContent = 'Save & Initialize Database';
            btn.disabled = false;
          }
        });

        document.getElementById('adminForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = e.target.querySelector('button');
          btn.textContent = 'Finishing...';
          btn.disabled = true;
          document.getElementById('adminError').textContent = '';

          const payload = {
            username: document.getElementById('adminUser').value,
            email: document.getElementById('adminEmail').value,
            password: document.getElementById('adminPass').value
          };

          try {
            const res = await fetch('/install/api/admin', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
              document.getElementById('step2').innerHTML = '<h2>Installation Complete!</h2><p>The backend will now restart. You can close this page and start using the app.</p>';
            } else {
              document.getElementById('adminError').textContent = data.error || 'Failed to create admin';
              btn.textContent = 'Create Admin & Finish';
              btn.disabled = false;
            }
          } catch (err) {
            document.getElementById('adminError').textContent = err.message;
            btn.textContent = 'Create Admin & Finish';
            btn.disabled = false;
          }
        });
      </script>
    </body>
    </html>
  `);
});

router.post('/api/env', async (req: Request, res: Response): Promise<void> => {
  try {
    const { DATABASE_URL, PORT, FRONTEND_URL, UPLOAD_DIR, WEB_ROOT } = req.body;
    
    if (!DATABASE_URL) {
      res.status(400).json({ error: 'DATABASE_URL is required' });
      return;
    }

    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const jwtRefreshSecret = crypto.randomBytes(32).toString('hex');

    const envContent = `
DATABASE_URL="${DATABASE_URL}"
PORT=${PORT || 3001}
FRONTEND_URL="${FRONTEND_URL || 'http://localhost:3000'}"
UPLOAD_DIR="${UPLOAD_DIR || './uploads'}"
WEB_ROOT="${WEB_ROOT || '/'}"
JWT_SECRET="${jwtSecret}"
JWT_REFRESH_SECRET="${jwtRefreshSecret}"
`.trim();

    fs.writeFileSync(envPath, envContent);

    // Update process.env for Prisma in current runtime
    process.env.DATABASE_URL = DATABASE_URL;

    // Run Prisma DB Push to initialize schema
    exec('npx prisma db push', { cwd: path.resolve(__dirname, '../../') }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Prisma Error:', stderr || error.message);
        res.status(500).json({ error: 'Database initialization failed. Please check your DATABASE_URL.' });
        return;
      }

      // Generate a temporary root token
      installToken = crypto.randomBytes(16).toString('hex');

      // Create a temporary root user in DB
      const prisma = new PrismaClient();
      try {
        let role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
        if (!role) {
          role = await prisma.role.create({ data: { name: 'SUPER_ADMIN', description: 'System Administrator' } });
        }

        const hashedPass = await argon2.hash(crypto.randomBytes(16).toString('hex'));
        
        // Upsert temp root user
        await prisma.user.upsert({
          where: { username: 'temp_root_install' },
          update: { roleId: role.id, status: UserStatus.ACTIVE, password: hashedPass },
          create: {
            username: 'temp_root_install',
            email: 'temp_root@install.local',
            password: hashedPass,
            roleId: role.id,
            status: UserStatus.ACTIVE
          }
        });
      } catch (dbErr) {
        console.error('DB Seed Error:', dbErr);
        res.status(500).json({ error: 'Failed to create temporary root account.' });
        return;
      } finally {
        await prisma.$disconnect();
      }

      res.json({ success: true, token: installToken });
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${installToken}`) {
    res.status(401).json({ error: 'Unauthorized. Invalid install token.' });
    return;
  }

  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email, and password are required' });
    return;
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) {
      res.status(500).json({ error: 'SUPER_ADMIN role not found' });
      return;
    }

    const hashedPass = await argon2.hash(password);

    // Create the real admin user
    await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPass,
        roleId: role.id,
        status: UserStatus.ACTIVE
      }
    });

    // Disable (ban) the temporary root account
    await prisma.user.updateMany({
      where: { username: 'temp_root_install' },
      data: { status: UserStatus.BANNED }
    });

    // Lock the installation in .env
    fs.appendFileSync(envPath, '\nINSTALL_LOCKED=true\n');

    res.json({ success: true });

    // Restart the backend after a short delay
    setTimeout(() => {
      console.log('Installation complete. Restarting server...');
      process.exit(0); // Assuming nodemon or pm2 will restart it
    }, 1000);

  } catch (err: any) {
    console.error('Admin Creation Error:', err);
    res.status(500).json({ error: 'Failed to create admin account. It may already exist.' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;
