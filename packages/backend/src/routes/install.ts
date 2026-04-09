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
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MyndBBS Installation</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; }
        .step-content { display: none; animation: fadeIn 0.3s ease-in-out; }
        .step-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>
    </head>
    <body class="min-h-screen flex items-center justify-center p-4">
      <div class="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <!-- Header -->
        <div class="bg-gray-900 px-8 py-6 text-white text-center">
          <h1 class="text-3xl font-bold tracking-tight">MyndBBS Setup</h1>
          <p class="text-gray-400 mt-2 text-sm">Configure your new forum infrastructure</p>
        </div>

        <!-- Progress Bar -->
        <div class="bg-gray-50 border-b border-gray-200 px-8 py-4">
          <div class="flex items-center justify-between relative">
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded"></div>
            <div id="progress-bar" class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 rounded transition-all duration-300" style="width: 0%"></div>
            
            <div class="relative z-10 flex flex-col items-center">
              <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm border-4 border-white">1</div>
              <span class="text-xs font-medium text-gray-900 mt-1">Welcome</span>
            </div>
            <div class="relative z-10 flex flex-col items-center">
              <div id="indicator-2" class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold text-sm border-4 border-white transition-colors duration-300">2</div>
              <span id="label-2" class="text-xs font-medium text-gray-500 mt-1 transition-colors duration-300">Database</span>
            </div>
            <div class="relative z-10 flex flex-col items-center">
              <div id="indicator-3" class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold text-sm border-4 border-white transition-colors duration-300">3</div>
              <span id="label-3" class="text-xs font-medium text-gray-500 mt-1 transition-colors duration-300">App</span>
            </div>
            <div class="relative z-10 flex flex-col items-center">
              <div id="indicator-4" class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold text-sm border-4 border-white transition-colors duration-300">4</div>
              <span id="label-4" class="text-xs font-medium text-gray-500 mt-1 transition-colors duration-300">Admin</span>
            </div>
          </div>
        </div>

        <div class="px-8 py-8">
          <!-- Step 1: Welcome -->
          <div id="step-1" class="step-content active">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Welcome to MyndBBS</h2>
            <p class="text-gray-600 mb-6 leading-relaxed">This installation wizard will guide you through setting up your PostgreSQL database, configuring application environments, and creating your initial super admin account.</p>
            <button onclick="nextStep(2)" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">Start Installation</button>
          </div>

          <!-- Step 2: Database -->
          <div id="step-2" class="step-content">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Database Configuration</h2>
            <form id="dbForm" onsubmit="handleDbSubmit(event)">
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Host / IP</label>
                  <input type="text" id="dbHost" value="localhost" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input type="number" id="dbPort" value="5432" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                </div>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
                <input type="text" id="dbName" value="myndbbs" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              </div>
              <div class="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input type="text" id="dbUser" value="postgres" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" id="dbPass" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                </div>
              </div>
              <div class="flex justify-between items-center">
                <button type="button" onclick="prevStep(1)" class="text-gray-600 hover:text-gray-900 font-medium py-2 px-4">Back</button>
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">Next Step</button>
              </div>
            </form>
          </div>

          <!-- Step 3: Application Settings -->
          <div id="step-3" class="step-content">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Application Settings</h2>
            <form id="appForm" onsubmit="handleAppSubmit(event)">
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Backend Port</label>
                  <input type="number" id="appPort" value="3001" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Frontend URL</label>
                  <input type="url" id="frontendUrl" value="http://localhost:3000" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                </div>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Upload Directory Path</label>
                <input type="text" id="uploadDir" value="./uploads" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              </div>
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1">Website Root Directory</label>
                <input type="text" id="webRoot" value="/" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              </div>
              <div id="initError" class="text-red-600 text-sm mb-4 hidden bg-red-50 p-3 rounded-lg border border-red-200"></div>
              <div class="flex justify-between items-center">
                <button type="button" onclick="prevStep(2)" class="text-gray-600 hover:text-gray-900 font-medium py-2 px-4">Back</button>
                <button type="submit" id="initBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center justify-center min-w-[160px]">
                  <span id="initBtnText">Initialize Database</span>
                  <svg id="initBtnSpinner" class="animate-spin ml-2 h-5 w-5 text-white hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </button>
              </div>
            </form>
          </div>

          <!-- Step 4: Admin Account -->
          <div id="step-4" class="step-content">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Super Admin Setup</h2>
            <p class="text-sm text-gray-500 mb-6">Database initialized successfully! Now create your administrator account.</p>
            <form id="adminForm" onsubmit="handleAdminSubmit(event)">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" id="adminUser" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="adminEmail" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              </div>
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" id="adminPass" required minlength="8" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              </div>
              <div id="adminError" class="text-red-600 text-sm mb-4 hidden bg-red-50 p-3 rounded-lg border border-red-200"></div>
              <div class="flex justify-end items-center">
                <button type="submit" id="adminBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center justify-center min-w-[160px]">
                  <span id="adminBtnText">Finish Installation</span>
                  <svg id="adminBtnSpinner" class="animate-spin ml-2 h-5 w-5 text-white hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </button>
              </div>
            </form>
          </div>

          <!-- Step 5: Complete -->
          <div id="step-5" class="step-content text-center py-8">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Installation Complete!</h2>
            <p class="text-gray-600 mb-6">The system has been configured and the backend is restarting. You can now close this page and visit your frontend.</p>
            <a href="http://localhost:3000" id="goFrontend" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors">Go to Forum</a>
          </div>
        </div>
      </div>

      <script>
        let dbConfig = {};
        let appConfig = {};
        let installToken = '';

        function updateProgress(step) {
          const progressMap = {1: '0%', 2: '33%', 3: '66%', 4: '100%'};
          document.getElementById('progress-bar').style.width = progressMap[step];
          
          for(let i=2; i<=4; i++) {
            const ind = document.getElementById('indicator-'+i);
            const lbl = document.getElementById('label-'+i);
            if (step >= i) {
              ind.classList.remove('bg-gray-200', 'text-gray-500');
              ind.classList.add('bg-blue-600', 'text-white');
              lbl.classList.remove('text-gray-500');
              lbl.classList.add('text-gray-900');
            } else {
              ind.classList.add('bg-gray-200', 'text-gray-500');
              ind.classList.remove('bg-blue-600', 'text-white');
              lbl.classList.add('text-gray-500');
              lbl.classList.remove('text-gray-900');
            }
          }
        }

        function showStep(step) {
          document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
          document.getElementById('step-' + step).classList.add('active');
          if (step <= 4) updateProgress(step);
        }

        function nextStep(step) { showStep(step); }
        function prevStep(step) { showStep(step); }

        function handleDbSubmit(e) {
          e.preventDefault();
          dbConfig = {
            host: document.getElementById('dbHost').value,
            port: document.getElementById('dbPort').value,
            name: document.getElementById('dbName').value,
            user: document.getElementById('dbUser').value,
            pass: document.getElementById('dbPass').value
          };
          nextStep(3);
        }

        async function handleAppSubmit(e) {
          e.preventDefault();
          appConfig = {
            port: document.getElementById('appPort').value,
            frontendUrl: document.getElementById('frontendUrl').value,
            uploadDir: document.getElementById('uploadDir').value,
            webRoot: document.getElementById('webRoot').value
          };

          // Construct DB URL securely
          const { user, pass, host, port: dbPort, name } = dbConfig;
          const encodedUser = encodeURIComponent(user);
          const encodedPass = encodeURIComponent(pass);
          const dbUrl = \`postgresql://\${encodedUser}:\${encodedPass}@\${host}:\${dbPort}/\${name}?schema=public\`;

          const payload = {
            DATABASE_URL: dbUrl,
            PORT: appConfig.port,
            FRONTEND_URL: appConfig.frontendUrl,
            UPLOAD_DIR: appConfig.uploadDir,
            WEB_ROOT: appConfig.webRoot
          };

          const btn = document.getElementById('initBtn');
          const btnText = document.getElementById('initBtnText');
          const spinner = document.getElementById('initBtnSpinner');
          const errBox = document.getElementById('initError');

          btn.disabled = true;
          btnText.textContent = 'Initializing...';
          spinner.classList.remove('hidden');
          errBox.classList.add('hidden');

          try {
            const res = await fetch('/install/api/env', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
              installToken = data.token;
              document.getElementById('goFrontend').href = appConfig.frontendUrl;
              nextStep(4);
            } else {
              errBox.textContent = data.error || 'Failed to initialize database';
              errBox.classList.remove('hidden');
              btn.disabled = false;
              btnText.textContent = 'Initialize Database';
              spinner.classList.add('hidden');
            }
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
            btn.disabled = false;
            btnText.textContent = 'Initialize Database';
            spinner.classList.add('hidden');
          } 
        }

        async function handleAdminSubmit(e) {
          e.preventDefault();
          
          const payload = {
            username: document.getElementById('adminUser').value,
            email: document.getElementById('adminEmail').value,
            password: document.getElementById('adminPass').value
          };

          const btn = document.getElementById('adminBtn');
          const btnText = document.getElementById('adminBtnText');
          const spinner = document.getElementById('adminBtnSpinner');
          const errBox = document.getElementById('adminError');

          btn.disabled = true;
          btnText.textContent = 'Finishing...';
          spinner.classList.remove('hidden');
          errBox.classList.add('hidden');

          let resOk = false;
          try {
            const res = await fetch('/install/api/admin', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + installToken
              },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
              resOk = true;
              nextStep(5);
            } else {
              errBox.textContent = data.error || 'Failed to create admin';
              errBox.classList.remove('hidden');
            }
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
          } finally {
            if (!resOk) {
              btn.disabled = false;
              btnText.textContent = 'Finish Installation';
              spinner.classList.add('hidden');
            }
          }
        }
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
        res.status(500).json({ error: 'Database initialization failed. Please check your DATABASE credentials and ensure PostgreSQL is running.' });
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
    res.status(500).json({ error: 'Failed to create admin account. Username or email may already exist.' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;