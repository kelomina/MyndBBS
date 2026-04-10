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

router.get('/tailwind.js', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'tailwind.js'));
});

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
            sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
            serif: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
          },
          colors: {
            brand: {
              50: '#f6f6f9',
              100: '#ececf1',
              900: '#1a1a24',
            }
          },
          animation: {
            'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
            'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          },
          keyframes: {
            fadeInUp: {
              '0%': { opacity: '0', transform: 'translateY(15px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' },
            }
          }
        }
      }
    }
  </script>
  <style>
    body, html { 
      background-color: #FAFAFA; 
      color: #1a1a24;
      overflow-x: hidden;
      width: 100%;
      margin: 0;
      padding: 0;
    }
    .step-container {
      display: none;
      opacity: 0;
    }
    .step-container.active {
      display: block;
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    
    /* Custom Input Styles */
    .input-field {
      width: 100%;
      padding: 0.75rem 1rem;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      outline: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .input-field:focus {
      border-color: #1a1a24;
      box-shadow: 0 0 0 3px rgba(26, 26, 36, 0.1);
    }
    .input-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #4b5563;
      margin-bottom: 0.5rem;
    }
    .btn-primary {
      background-color: #1a1a24;
      color: white;
      padding: 0.875rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 500;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .btn-primary:hover:not(:disabled) {
      background-color: #2d2d3b;
      transform: translateY(-1px);
      box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.06);
    }
    .btn-primary:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .btn-secondary {
      background-color: #ffffff;
      color: #1a1a24;
      padding: 0.875rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 500;
      border: 1px solid #e5e7eb;
      transition: all 0.2s;
    }
    .btn-secondary:hover {
      background-color: #f9fafb;
      border-color: #d1d5db;
    }
    
    /* Left Panel Gradient & blobs */
    .bg-abstract {
      background: linear-gradient(135deg, #1a1a24 0%, #2d2d3b 100%);
      position: relative;
      overflow: hidden;
    }
    .bg-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.4;
    }
    .blob-1 { top: -10%; left: -10%; width: 300px; height: 300px; background: #6366f1; }
    .blob-2 { bottom: -20%; right: -10%; width: 400px; height: 400px; background: #a855f7; }
    .blob-3 { top: 40%; left: 50%; width: 250px; height: 250px; background: #ec4899; }
  </style>
</head>
<body class="antialiased selection:bg-brand-900 selection:text-white w-full m-0 p-0">
  <div class="flex flex-col lg:flex-row min-h-screen w-full m-0 p-0">
    
    <!-- Left Panel -->
    <div class="hidden lg:flex lg:w-5/12 xl:w-1/3 bg-abstract text-white flex-col justify-between p-12 relative min-h-screen shrink-0">
      <div class="bg-blob blob-1 animate-pulse-slow"></div>
      <div class="bg-blob blob-2 animate-pulse-slow" style="animation-delay: 1s;"></div>
      <div class="bg-blob blob-3 animate-pulse-slow" style="animation-delay: 2s;"></div>
      
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-16">
          <div class="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
          </div>
          <span class="text-2xl font-bold tracking-tight">MyndBBS</span>
        </div>
        
        <h1 class="text-4xl font-serif font-medium leading-tight mb-6">
          构建下一代<br/><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">优雅社区</span>
        </h1>
        <p class="text-white/70 text-lg max-w-md leading-relaxed">
          简单几步，完成您的论坛基础设施配置。我们将为您设置数据库、应用环境和超级管理员。
        </p>
      </div>

      <!-- Stepper -->
      <div class="relative z-10">
        <div class="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/20 before:to-transparent hidden md:block">
          <div id="nav-step-1" class="flex items-center gap-4 transition-all duration-300">
            <div class="w-8 h-8 rounded-full bg-white text-brand-900 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all relative z-10">1</div>
            <span class="font-medium text-white relative z-10">欢迎</span>
          </div>
          <div id="nav-step-2" class="flex items-center gap-4 opacity-50 transition-all duration-300">
            <div class="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center font-bold text-sm transition-all bg-[#1a1a24] relative z-10">2</div>
            <span class="font-medium text-white relative z-10">数据库配置</span>
          </div>
          <div id="nav-step-3" class="flex items-center gap-4 opacity-50 transition-all duration-300">
            <div class="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center font-bold text-sm transition-all bg-[#1a1a24] relative z-10">3</div>
            <span class="font-medium text-white relative z-10">应用设置</span>
          </div>
          <div id="nav-step-4" class="flex items-center gap-4 opacity-50 transition-all duration-300">
            <div class="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center font-bold text-sm transition-all bg-[#1a1a24] relative z-10">4</div>
            <span class="font-medium text-white relative z-10">管理员</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Panel -->
    <div class="w-full flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-24 relative min-h-screen bg-white m-0">
      <!-- Mobile header -->
      <div class="absolute top-8 left-8 lg:hidden flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-brand-900 flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
        </div>
        <span class="text-xl font-bold tracking-tight text-brand-900">MyndBBS</span>
      </div>

      <div class="w-full max-w-lg">
        <!-- Step 1 -->
        <div id="step-1" class="step-container active">
          <div class="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-6">安装向导</div>
          <h2 class="text-3xl font-bold mb-4 text-brand-900">准备就绪</h2>
          <p class="text-gray-500 mb-8 text-lg leading-relaxed">
            欢迎来到 MyndBBS 安装程序。在开始之前，请确保您已经准备好了 PostgreSQL 数据库的连接信息。
          </p>
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
            <h3 class="font-semibold text-brand-900 mb-3 flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              您需要准备：
            </h3>
            <ul class="space-y-3 text-sm text-gray-600">
              <li class="flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-400"></div> 数据库主机地址和端口</li>
              <li class="flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-400"></div> 数据库名称、用户名及密码</li>
              <li class="flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-400"></div> 决定应用运行的端口及访问域名</li>
            </ul>
          </div>
          <button onclick="nextStep(2)" class="btn-primary w-full group">
            开始配置
            <svg class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>

        <!-- Step 2 -->
        <div id="step-2" class="step-container">
          <h2 class="text-3xl font-bold mb-2 text-brand-900">数据库配置</h2>
          <p class="text-gray-500 mb-8">输入您的 PostgreSQL 数据库连接详情。</p>
          
          <form id="dbForm" onsubmit="handleDbSubmit(event)" class="space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="input-label">数据库域名或 IP</label>
                <input type="text" id="dbHost" value="localhost" required class="input-field" placeholder="127.0.0.1">
              </div>
              <div>
                <label class="input-label">数据库端口</label>
                <input type="number" id="dbPort" value="5432" required class="input-field" placeholder="5432">
              </div>
            </div>
            <div>
              <label class="input-label">数据库名称</label>
              <input type="text" id="dbName" value="myndbbs" required class="input-field" placeholder="myndbbs">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="input-label">数据库用户名</label>
                <input type="text" id="dbUser" value="postgres" required class="input-field" placeholder="postgres">
              </div>
              <div>
                <label class="input-label">数据库密码</label>
                <input type="password" id="dbPass" required class="input-field" placeholder="••••••••">
              </div>
            </div>
            <div class="pt-6 flex gap-4">
              <button type="button" onclick="prevStep(1)" class="btn-secondary w-1/3">返回</button>
              <button type="submit" class="btn-primary w-2/3">下一步</button>
            </div>
          </form>
        </div>

        <!-- Step 3 -->
        <div id="step-3" class="step-container">
          <h2 class="text-3xl font-bold mb-2 text-brand-900">应用设置</h2>
          <p class="text-gray-500 mb-8">配置后端的运行环境及静态资源路径。</p>
          
          <form id="appForm" onsubmit="handleAppSubmit(event)" class="space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="input-label">后端端口</label>
                <input type="number" id="appPort" value="3001" required class="input-field">
              </div>
              <div>
                <label class="input-label">前端访问地址</label>
                <input type="url" id="frontendUrl" value="http://localhost:3000" required class="input-field" placeholder="https://bbs.example.com">
              </div>
            </div>
            <div>
              <label class="input-label">上传目录路径</label>
              <input type="text" id="uploadDir" value="./uploads" required class="input-field" placeholder="./uploads">
              <p class="text-xs text-gray-400 mt-1.5">用于存储用户上传的图片和附件</p>
            </div>
            <div>
              <label class="input-label">网站根目录</label>
              <input type="text" id="webRoot" value="/" required class="input-field" placeholder="/">
            </div>
            
            <div id="initError" class="hidden mt-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm"></div>
            
            <div class="pt-6 flex gap-4">
              <button type="button" onclick="prevStep(2)" class="btn-secondary w-1/3" id="btnBackApp">返回</button>
              <button type="submit" id="initBtn" class="btn-primary w-2/3 flex items-center justify-center">
                <span id="initBtnText">初始化数据库</span>
                <svg id="initBtnSpinner" class="animate-spin ml-2 h-5 w-5 text-white hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </button>
            </div>
          </form>
        </div>

        <!-- Step 4 -->
        <div id="step-4" class="step-container">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-500 mb-6">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 class="text-3xl font-bold mb-2 text-brand-900">创建超级管理员</h2>
          <p class="text-gray-500 mb-8">数据库初始化成功！请设置您的最高权限管理员账户。</p>
          
          <form id="adminForm" onsubmit="handleAdminSubmit(event)" class="space-y-5">
            <div>
              <label class="input-label">管理员用户名</label>
              <input type="text" id="adminUser" required class="input-field" placeholder="admin">
            </div>
            <div>
              <label class="input-label">管理员邮箱</label>
              <input type="email" id="adminEmail" required class="input-field" placeholder="admin@example.com">
            </div>
            <div>
              <label class="input-label">管理员密码</label>
              <input type="password" id="adminPass" required minlength="8" class="input-field" placeholder="至少 8 位字符">
            </div>
            
            <div id="adminError" class="hidden mt-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm"></div>
            
            <div class="pt-6">
              <button type="submit" id="adminBtn" class="btn-primary w-full flex items-center justify-center">
                <span id="adminBtnText">完成安装</span>
                <svg id="adminBtnSpinner" class="animate-spin ml-2 h-5 w-5 text-white hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </button>
            </div>
          </form>
        </div>

        <!-- Step 5 -->
        <div id="step-5" class="step-container text-center py-10">
          <div class="relative w-24 h-24 mx-auto mb-8">
            <div class="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-50" style="animation-duration: 3s;"></div>
            <div class="relative w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
              <svg class="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
          <h2 class="text-3xl font-bold mb-4 text-brand-900">安装大功告成！</h2>
          <p class="text-gray-500 mb-10 text-lg max-w-md mx-auto">
            系统已配置完毕，后端服务正在重新启动。<br/>欢迎使用 MyndBBS，开启您的社区之旅。
          </p>
          <a href="http://localhost:3000" id="goFrontend" class="btn-primary px-8 py-3.5 text-lg w-full sm:w-auto">
            前往前台论坛
            <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </a>
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
        const navEl = document.getElementById('nav-step-'+i);
        if(!navEl) continue;
        
        const circle = navEl.querySelector('div');
        if (i < step) {
          // Completed
          navEl.classList.remove('opacity-50');
          circle.className = 'w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm backdrop-blur-sm transition-all relative z-10';
          circle.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
        } else if (i === step) {
          // Active
          navEl.classList.remove('opacity-50');
          circle.className = 'w-8 h-8 rounded-full bg-white text-brand-900 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all relative z-10';
          circle.innerHTML = i;
        } else {
          // Pending
          navEl.classList.add('opacity-50');
          circle.className = 'w-8 h-8 rounded-full border border-white/30 flex items-center justify-center font-bold text-sm transition-all bg-[#1a1a24] relative z-10';
          circle.innerHTML = i;
        }
      }
    }

    function showStep(step) {
      document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('step-' + step);
      if(target) {
        // Trigger reflow for animation
        void target.offsetWidth;
        target.classList.add('active');
      }
      if (step <= 4) updateNav(step);
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
      const btnBack = document.getElementById('btnBackApp');
      const btnText = document.getElementById('initBtnText');
      const spinner = document.getElementById('initBtnSpinner');
      const errBox = document.getElementById('initError');

      btn.disabled = true;
      btnBack.disabled = true;
      btnText.textContent = '初始化中...';
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
          errBox.textContent = data.error || '初始化数据库失败';
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btnBack.disabled = false;
          btnText.textContent = '初始化数据库';
          spinner.classList.add('hidden');
        }
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btnBack.disabled = false;
        btnText.textContent = '初始化数据库';
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
      btnText.textContent = '正在完成...';
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
          errBox.textContent = data.error || '创建管理员失败';
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
    res.status(500).json({ error: '创建管理员账户失败。用户名或邮箱可能已存在。' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;