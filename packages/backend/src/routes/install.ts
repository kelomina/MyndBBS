import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient, UserStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router: import('express').Router = Router();
const envPath = path.resolve(__dirname, '../../.env');

// Temporary in-memory token for the install session
let installToken = '';

/**
 * Callers: []
 * Callees: [sendFile, join]
 * Description: An anonymous route handler that serves the tailwind script for the installer.
 * Keywords: install, tailwind, get, route, anonymous
 */
router.get('/tailwind.js', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'tailwind.js'));
});

/**
 * Callers: []
 * Callees: [send]
 * Description: An anonymous route handler that serves the installer HTML UI.
 * Keywords: install, ui, get, route, html, anonymous
 */
router.get('/', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyndBBS 安装向导</title>
  <script src="/install/tailwind.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
          },
          colors: {
            surface: '#fbfbfb',
            ink: '#111111',
            accent: '#0055FF',
            border: '#eaeaea'
          },
          animation: {
            'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            'slide-up': 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          },
          keyframes: {
            fadeIn: {
              '0%': { opacity: '0' },
              '100%': { opacity: '1' },
            },
            slideUp: {
              '0%': { opacity: '0', transform: 'translateY(20px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' },
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #fbfbfb;
      color: #111111;
      margin: 0;
      padding: 0;
      width: 100vw;
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .layout-wrapper {
      display: flex;
      width: 100vw;
      min-height: 100vh;
      flex-direction: row;
    }

    @media (max-width: 1024px) {
      .layout-wrapper {
        flex-direction: column;
      }
    }

    /* Left Side - Pure & Minimal */
    .sidebar {
      width: 400px;
      flex-shrink: 0;
      background-color: #111111;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      padding: 3rem;
      border-right: 1px solid rgba(255,255,255,0.1);
      position: relative;
    }

    @media (max-width: 1024px) {
      .sidebar {
        width: 100%;
        padding: 2rem;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
    }

    /* Right Side - Content Area */
    .main-content {
      flex: 1 1 0%;
      background-color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      position: relative;
    }

    @media (max-width: 1024px) {
      .main-content {
        padding: 2rem;
      }
    }

    .form-container {
      width: 100%;
      max-width: 480px;
    }

    .step-section {
      display: none;
      opacity: 0;
    }
    
    .step-section.active {
      display: block;
      animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .input-wrapper {
      margin-bottom: 1.5rem;
    }

    .input-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #444;
      margin-bottom: 0.5rem;
    }

    .minimal-input {
      width: 100%;
      background: transparent;
      border: none;
      border-bottom: 2px solid #eaeaea;
      padding: 0.75rem 0;
      font-size: 1.125rem;
      color: #111;
      transition: all 0.3s ease;
      outline: none;
      border-radius: 0;
    }

    .minimal-input:focus {
      border-bottom-color: #111;
    }

    .minimal-input::placeholder {
      color: #aaa;
    }

    .btn-dark {
      background-color: #111;
      color: #fff;
      padding: 1rem 2rem;
      font-size: 1rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: transform 0.2s ease, background 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin-top: 1rem;
    }

    .btn-dark:hover:not(:disabled) {
      background-color: #000;
      transform: translateY(-2px);
    }

    .btn-dark:disabled {
      background-color: #666;
      cursor: not-allowed;
    }

    .btn-ghost {
      background-color: transparent;
      color: #666;
      padding: 1rem;
      font-size: 1rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: color 0.2s ease;
      width: 100%;
    }

    .btn-ghost:hover {
      color: #111;
    }

    /* Stepper UI */
    .step-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      opacity: 0.4;
      transition: opacity 0.3s ease;
    }

    .step-item.completed {
      opacity: 1;
    }

    .step-item.current {
      opacity: 1;
    }

    .step-number {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .step-item.current .step-number {
      background-color: #fff;
      color: #111;
      border-color: #fff;
    }

    .step-item.completed .step-number {
      background-color: rgba(255,255,255,0.1);
      color: #fff;
      border-color: transparent;
    }

    .step-text {
      font-size: 1rem;
      font-weight: 500;
    }
  </style>
</head>
<body>
  
  <div class="layout-wrapper">
    
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="flex items-center gap-3 mb-16 animate-fade-in">
        <div class="w-8 h-8 bg-white text-ink flex items-center justify-center font-bold text-xl rounded-sm">M</div>
        <span class="text-xl font-bold tracking-tight">MyndBBS</span>
      </div>

      <div class="mt-auto animate-slide-up" style="animation-delay: 0.2s;">
        <div id="nav-1" class="step-item current">
          <div class="step-number">1</div>
          <div class="step-text">欢迎</div>
        </div>
        <div id="nav-2" class="step-item">
          <div class="step-number">2</div>
          <div class="step-text">数据库连接</div>
        </div>
        <div id="nav-3" class="step-item">
          <div class="step-number">3</div>
          <div class="step-text">应用环境</div>
        </div>
        <div id="nav-4" class="step-item">
          <div class="step-number">4</div>
          <div class="step-text">超级管理员</div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      
      <div class="form-container">
        
        <!-- Step 1: Welcome -->
        <div id="step-1" class="step-section active">
          <h1 class="text-4xl font-bold mb-4 tracking-tight">初始化您的社区</h1>
          <p class="text-gray-500 text-lg mb-12 leading-relaxed">
            仅需简单的几个步骤，我们即可为您搭建好 MyndBBS 的基础运行环境。在此之前，请确保您已准备好 PostgreSQL 数据库。
          </p>
          <button onclick="goToStep(2)" class="btn-dark">开始配置</button>
        </div>

        <!-- Step 2: Database -->
        <div id="step-2" class="step-section">
          <h2 class="text-3xl font-bold mb-2 tracking-tight">数据库连接</h2>
          <p class="text-gray-500 mb-10">输入 PostgreSQL 数据库的详细凭据。</p>
          
          <form id="dbForm" onsubmit="handleDbSubmit(event)">
            <div class="flex gap-6">
              <div class="input-wrapper flex-1">
                <label class="input-label">主机地址</label>
                <input type="text" id="dbHost" value="localhost" required class="minimal-input" placeholder="127.0.0.1">
              </div>
              <div class="input-wrapper w-32">
                <label class="input-label">端口</label>
                <input type="number" id="dbPort" value="5432" required class="minimal-input" placeholder="5432">
              </div>
            </div>
            
            <div class="input-wrapper">
              <label class="input-label">数据库名称</label>
              <input type="text" id="dbName" value="myndbbs" required class="minimal-input" placeholder="myndbbs">
            </div>

            <div class="flex gap-6 mt-4">
              <div class="input-wrapper flex-1">
                <label class="input-label">用户名</label>
                <input type="text" id="dbUser" value="postgres" required class="minimal-input" placeholder="postgres">
              </div>
              <div class="input-wrapper flex-1">
                <label class="input-label">密码</label>
                <input type="password" id="dbPass" required class="minimal-input" placeholder="••••••••">
              </div>
            </div>

            <div class="flex flex-col-reverse sm:flex-row gap-4 mt-8">
              <button type="button" onclick="goToStep(1)" class="btn-ghost sm:w-1/3">上一步</button>
              <button type="submit" class="btn-dark sm:w-2/3 sm:mt-0">继续</button>
            </div>
          </form>
        </div>

        <!-- Step 3: Application -->
        <div id="step-3" class="step-section">
          <h2 class="text-3xl font-bold mb-2 tracking-tight">应用环境</h2>
          <p class="text-gray-500 mb-10">配置应用运行端口与前端跨域地址。</p>
          
          <form id="appForm" onsubmit="handleAppSubmit(event)">
            <div class="flex gap-6">
              <div class="input-wrapper w-1/3">
                <label class="input-label">后端端口</label>
                <input type="number" id="appPort" value="3001" required class="minimal-input">
              </div>
              <div class="input-wrapper flex-1">
                <label class="input-label">前端 URL (跨域来源)</label>
                <input type="url" id="frontendUrl" value="http://localhost:3000" required class="minimal-input" placeholder="https://bbs.example.com">
              </div>
            </div>

            <div class="input-wrapper mt-4">
              <label class="input-label">上传存储目录</label>
              <input type="text" id="uploadDir" value="./uploads" required class="minimal-input">
            </div>

            <div class="input-wrapper mt-4">
              <label class="input-label">网站根目录路径</label>
              <input type="text" id="webRoot" value="/" required class="minimal-input">
            </div>
            
            <div id="initError" class="hidden mt-6 p-4 bg-red-50 text-red-600 text-sm border-l-4 border-red-500"></div>

            <div class="flex flex-col-reverse sm:flex-row gap-4 mt-8">
              <button type="button" onclick="goToStep(2)" class="btn-ghost sm:w-1/3" id="btnBackApp">上一步</button>
              <button type="submit" id="initBtn" class="btn-dark sm:w-2/3 sm:mt-0">
                <span id="initBtnText">写入配置并初始化</span>
                <svg id="initBtnSpinner" class="animate-spin ml-3 h-5 w-5 text-white hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </button>
            </div>
          </form>
        </div>

        <!-- Step 4: Admin -->
        <div id="step-4" class="step-section">
          <h2 class="text-3xl font-bold mb-2 tracking-tight">超级管理员</h2>
          <p class="text-gray-500 mb-10">数据库已准备就绪，请创建您的最高权限账户。</p>
          
          <form id="adminForm" onsubmit="handleAdminSubmit(event)">
            <div class="input-wrapper">
              <label class="input-label">管理员用户名</label>
              <input type="text" id="adminUser" required class="minimal-input" placeholder="admin">
            </div>
            
            <div class="input-wrapper mt-4">
              <label class="input-label">邮箱地址</label>
              <input type="email" id="adminEmail" required class="minimal-input" placeholder="admin@example.com">
            </div>
            
            <div class="input-wrapper mt-4">
              <label class="input-label">登录密码</label>
              <input type="password" id="adminPass" required minlength="8" class="minimal-input" placeholder="至少 8 位安全密码">
            </div>
            
            <div id="adminError" class="hidden mt-6 p-4 bg-red-50 text-red-600 text-sm border-l-4 border-red-500"></div>

            <div class="mt-10">
              <button type="submit" id="adminBtn" class="btn-dark">
                <span id="adminBtnText">完成安装</span>
                <svg id="adminBtnSpinner" class="animate-spin ml-3 h-5 w-5 text-white hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </button>
            </div>
          </form>
        </div>

        <!-- Step 5: Success -->
        <div id="step-5" class="step-section text-center">
          <div class="w-20 h-20 bg-ink text-white rounded-full flex items-center justify-center mx-auto mb-8 animate-slide-up">
            <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 class="text-3xl font-bold mb-4 tracking-tight">部署成功</h2>
          <p class="text-gray-500 mb-12 text-lg">
            您的 MyndBBS 后端服务已配置完毕并正在重启。<br/>现在，您可以直接前往前端论坛进行体验。
          </p>
          <a href="http://localhost:3000" id="goFrontend" class="btn-dark">进入论坛</a>
        </div>

      </div>
    </div>
  </div>

  <script>
    let dbConfig = {};
    let appConfig = {};
    let installToken = '';

    function updateNav(step) {
      for(let i=1; i<=4; i++) {
        const navEl = document.getElementById('nav-'+i);
        if(!navEl) continue;
        
        if (i < step) {
          navEl.className = 'step-item completed';
          navEl.querySelector('.step-number').innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
        } else if (i === step) {
          navEl.className = 'step-item current';
          navEl.querySelector('.step-number').innerHTML = i;
        } else {
          navEl.className = 'step-item';
          navEl.querySelector('.step-number').innerHTML = i;
        }
      }
    }

    function goToStep(step) {
      document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('step-' + step);
      if(target) {
        void target.offsetWidth; // trigger reflow
        target.classList.add('active');
      }
      if (step <= 4) updateNav(step);
    }

    function handleDbSubmit(e) {
      e.preventDefault();
      dbConfig = {
        host: document.getElementById('dbHost').value,
        port: document.getElementById('dbPort').value,
        name: document.getElementById('dbName').value,
        user: document.getElementById('dbUser').value,
        pass: document.getElementById('dbPass').value
      };
      goToStep(3);
    }

    async function handleAppSubmit(e) {
      e.preventDefault();
      appConfig = {
        port: document.getElementById('appPort').value,
        frontendUrl: document.getElementById('frontendUrl').value,
        uploadDir: document.getElementById('uploadDir').value,
        webRoot: document.getElementById('webRoot').value
      };

      const { user, pass, host, port: dbPort, name } = dbConfig;
      const encodedUser = encodeURIComponent(user);
      const encodedPass = encodeURIComponent(pass);
      // ESCAPED TO AVOID TS ERRORS
      const dbUrl = 'postgresql://' + encodedUser + ':' + encodedPass + '@' + host + ':' + dbPort + '/' + name + '?schema=public';

      const payload = {
        DATABASE_URL: dbUrl,
        PORT: appConfig.port,
        FRONTEND_URL: appConfig.frontendUrl,
        UPLOAD_DIR: appConfig.uploadDir,
        WEB_ROOT: appConfig.webRoot
      };

      const btn = document.getElementById('initBtn');
      const btnBack = document.getElementById('btnBackApp');
      const btnText = document.getElementById('initBtnText');
      const spinner = document.getElementById('initBtnSpinner');
      const errBox = document.getElementById('initError');

      btn.disabled = true;
      btnBack.disabled = true;
      btnText.textContent = '处理中...';
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
          goToStep(4);
        } else {
          errBox.textContent = data.error || '初始化失败';
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btnBack.disabled = false;
          btnText.textContent = '写入配置并初始化';
          spinner.classList.add('hidden');
        }
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btnBack.disabled = false;
        btnText.textContent = '写入配置并初始化';
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
      btnText.textContent = '正在保存...';
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
          btnText.textContent = '正在重启并前往安全设置...';
          setTimeout(() => {
            window.location.href = appConfig.frontendUrl + '/admin-setup';
          }, 3000);
          return;
        } else {
          errBox.textContent = data.error || '创建失败';
          errBox.classList.remove('hidden');
        }
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        if (!resOk) {
          btn.disabled = false;
          btnText.textContent = '完成安装';
          spinner.classList.add('hidden');
        }
      }
    }
  </script>
</body>
</html>
  `);
});

/**
 * Callers: []
 * Callees: [json, status, writeFileSync, config, exec, resolve, reject, error]
 * Description: An anonymous route handler that processes database and environment configuration during installation.
 * Keywords: install, env, config, post, anonymous
 */
router.post('/api/env', async (req: Request, res: Response): Promise<void> => {
  try {
    const { DATABASE_URL, PORT, FRONTEND_URL, UPLOAD_DIR, WEB_ROOT } = req.body;
    
    if (!DATABASE_URL) {
      res.status(400).json({ error: '缺少 DATABASE_URL' });
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
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_REFRESH_SECRET = jwtRefreshSecret;

    // Run Prisma DB Push to initialize schema
    exec('npx prisma db push', { cwd: path.resolve(__dirname, '../../') }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Prisma Error:', stderr || error.message);
        res.status(500).json({ error: '数据库初始化失败，请检查您的数据库凭据并确保 PostgreSQL 正在运行。' });
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
        res.status(500).json({ error: '创建临时管理员账户失败。' });
        return;
      } finally {
        await prisma.$disconnect();
      }

      res.json({ success: true, token: installToken });
    });
  } catch (err) {
    res.status(500).json({ error: '内部服务器错误' });
  }
});

/**
 * Callers: []
 * Callees: [json, status, hash, create, findFirst, appendFileSync, exec, resolve, reject, error]
 * Description: An anonymous route handler that processes admin account creation and finalizes installation.
 * Keywords: install, admin, account, setup, post, anonymous
 */
router.post('/api/admin', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${installToken}`) {
    res.status(401).json({ error: '未授权，无效的安装令牌。' });
    return;
  }

  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: '用户名、邮箱和密码是必填项' });
    return;
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) {
      res.status(500).json({ error: '未找到 SUPER_ADMIN 角色' });
      return;
    }

    const hashedPass = await argon2.hash(password);

      // Check if user already exists (e.g. from a previous failed install attempt)
      let user = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] }
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username,
            email,
            password: hashedPass,
            roleId: role.id,
            status: UserStatus.ACTIVE
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            username,
            email,
            password: hashedPass,
            roleId: role.id,
            status: UserStatus.ACTIVE
          }
        });
      }

    // Disable (ban) the temporary root account
    await prisma.user.updateMany({
      where: { username: 'temp_root_install' },
      data: { status: UserStatus.BANNED }
    });

    // Lock the installation in .env
    fs.appendFileSync(envPath, '\nINSTALL_LOCKED=true\n');

    const tempToken = jwt.sign({ userId: user.id, type: 'registration' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.cookie('tempToken', tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000
    });

    res.json({ success: true });

    // Restart the backend after a short delay
    setTimeout(() => {
      console.log('Installation complete. Restarting server...');
      // Touch index.ts to trigger nodemon restart cleanly
      const indexPath = path.resolve(__dirname, '../index.ts');
      const time = new Date();
      try {
        fs.utimesSync(indexPath, time, time);
      } catch (err) {
        fs.closeSync(fs.openSync(indexPath, 'w'));
      }
    }, 1000);

  } catch (err: any) {
    console.error('Admin Creation Error:', err);
    res.status(500).json({ error: '创建管理员账户失败，请检查日志。' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;