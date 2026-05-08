// MyndBBS Installation Wizard - JavaScript
(function() {
  let dbConfig = {};
  let appConfig = {};
  let domainConfig = {};
  let installToken = '';

  function updateNav(step) {
    for (let i = 1; i <= 5; i++) {
      const navEl = document.getElementById('nav-' + i);
      if (!navEl) continue;
      if (i < step) {
        navEl.className = 'step-item completed';
        navEl.querySelector('.step-num').innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
      } else if (i === step) {
        navEl.className = 'step-item current';
        navEl.querySelector('.step-num').innerHTML = i;
      } else {
        navEl.className = 'step-item';
        navEl.querySelector('.step-num').innerHTML = i;
      }
    }
  }

  window.goToStep = function(step) {
    document.querySelectorAll('.step').forEach(function(el) { el.classList.remove('active'); });
    var target = document.getElementById('step-' + step);
    if (target) {
      void target.offsetWidth;
      target.classList.add('active');
    }
    if (step <= 5) updateNav(step);
  };

  window.handleDbSubmit = function(e) {
    e.preventDefault();
    dbConfig = {
      host: document.getElementById('dbHost').value,
      port: document.getElementById('dbPort').value,
      name: document.getElementById('dbName').value,
      user: document.getElementById('dbUser').value,
      pass: document.getElementById('dbPass').value
    };
    window.goToStep(3);
  };

  window.handleAppSubmit = function(e) {
    e.preventDefault();
    appConfig = {
      port: document.getElementById('appPort').value,
      frontendUrl: document.getElementById('frontendUrl').value,
      uploadDir: document.getElementById('uploadDir').value,
      webRoot: document.getElementById('webRoot').value
    };
    window.goToStep(4);
  };

  window.handleDomainSubmit = async function(e) {
    e.preventDefault();
    domainConfig = {
      protocol: document.getElementById('protocol').value,
      hostname: document.getElementById('hostname').value.trim(),
      rpId: document.getElementById('rpId').value.trim(),
      reverseProxyMode: document.getElementById('reverseProxyMode').checked
    };
    var user = dbConfig.user, pass = dbConfig.pass, host = dbConfig.host;
    var dbPort = dbConfig.port, name = dbConfig.name;
    var dbUrl = 'postgresql://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@' + host + ':' + dbPort + '/' + name + '?schema=public';
    var payload = {
      DATABASE_URL: dbUrl, PORT: appConfig.port, FRONTEND_URL: appConfig.frontendUrl,
      UPLOAD_DIR: appConfig.uploadDir, WEB_ROOT: appConfig.webRoot,
      PROTOCOL: domainConfig.protocol, HOSTNAME: domainConfig.hostname,
      RP_ID: domainConfig.rpId, REVERSE_PROXY_MODE: domainConfig.reverseProxyMode
    };
    var btn = document.getElementById('domainInitBtn');
    var btnBack = document.getElementById('btnBackDomain');
    var btnText = document.getElementById('domainInitBtnText');
    var spinner = document.getElementById('domainInitBtnSpinner');
    var errBox = document.getElementById('domainInitError');
    btn.disabled = true; btnBack.disabled = true;
    btnText.textContent = '处理中...';
    spinner.classList.remove('hidden');
    errBox.classList.add('hidden');
    try {
      var res = await fetch('/install/api/env', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      var data = await res.json();
      if (res.ok) {
        installToken = data.token;
        document.getElementById('goFrontend').href = appConfig.frontendUrl;
        window.goToStep(5);
      } else {
        errBox.textContent = data.error || '初始化失败';
        errBox.classList.remove('hidden');
        btn.disabled = false; btnBack.disabled = false;
        btnText.textContent = '写入配置并初始化';
        spinner.classList.add('hidden');
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false; btnBack.disabled = false;
      btnText.textContent = '写入配置并初始化';
      spinner.classList.add('hidden');
    }
  };

  window.handleAdminSubmit = async function(e) {
    e.preventDefault();
    var payload = {
      username: document.getElementById('adminUser').value,
      email: document.getElementById('adminEmail').value,
      password: document.getElementById('adminPass').value
    };
    var btn = document.getElementById('adminBtn');
    var btnText = document.getElementById('adminBtnText');
    var spinner = document.getElementById('adminBtnSpinner');
    var errBox = document.getElementById('adminError');
    btn.disabled = true;
    btnText.textContent = '正在保存...';
    spinner.classList.remove('hidden');
    errBox.classList.add('hidden');
    var resOk = false;
    try {
      var res = await fetch('/install/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + installToken }, body: JSON.stringify(payload) });
      var data = await res.json();
      if (res.ok) {
        resOk = true;
        btnText.textContent = '正在重启并前往安全设置...';
        setTimeout(function() { window.location.href = appConfig.frontendUrl + '/admin-setup'; }, 3000);
        return;
      } else {
        errBox.textContent = data.message || data.error || '创建失败';
        errBox.classList.remove('hidden');
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      if (!resOk) { btn.disabled = false; btnText.textContent = '完成安装'; spinner.classList.add('hidden'); }
    }
  };
})();
