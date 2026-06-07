/**
 * Install Controller
 * Handles the initial setup and installation process of the application.
 */
import { Request, Response } from 'express';
import { installationApplicationService } from '../registry';
import { getAuthCookieOptions } from '../lib/securityConfig';

/**
 * Callers: []
 * Callees: [sendFile]
 * Description: Serves the tailwind script for the installer.
 * Keywords: install, tailwind, get, route
 */
export const getTailwindScript = (req: Request, res: Response): void => {
  res.sendFile('routes/tailwind.js', { root: __dirname + '/../' });
};

/**
 * Callers: []
 * Callees: [send]
 * Description: Serves the installer HTML UI.
 * Keywords: install, ui, get, route, html
 */
export const getInstallHtml = (req: Request, res: Response): void => {
  const fs = require('fs');
  const path = require('path');
  const htmlPath = path.join(__dirname, '..', 'views', 'install.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const frontendUrl = (process.env.FRONTEND_URL || 'http://127.0.0.1:3100')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  html = html.replace(/\{\{FRONTEND_URL\}\}/g, frontendUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

/**
 * Callers: []
 * Callees: [json, status, writeFileSync, config, exec, resolve, reject, error]
 * Description: Processes database and environment configuration during installation.
 * Keywords: install, env, config, post
 */
export const setupEnv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { DATABASE_URL, PORT, FRONTEND_URL, UPLOAD_DIR, WEB_ROOT, PROTOCOL, HOSTNAME, RP_ID, REVERSE_PROXY_MODE } = req.body;

    if (!DATABASE_URL) {
      res.status(400).json({ error: 'ERR_MISSING_DATABASE_URL' });
      return;
    }

    const protocol = PROTOCOL === 'https' ? 'https' : 'http';
    const hostname = String(HOSTNAME || 'localhost').trim();
    const rpId = String(RP_ID || hostname).trim();
    const reverseProxyMode = !!REVERSE_PROXY_MODE;

    try {
      const sessionId = await installationApplicationService.setupEnvironment({
        databaseUrl: DATABASE_URL,
        port: PORT,
        frontendUrl: FRONTEND_URL,
        uploadDir: UPLOAD_DIR,
        webRoot: WEB_ROOT,
        protocol,
        hostname,
        rpId,
        reverseProxyMode
      });
      
      res.json({ success: true, token: sessionId });
    } catch (err: any) {
      const errorCode = typeof err?.message === 'string' && err.message.startsWith('ERR_')
        ? err.message
        : 'ERR_INTERNAL_SERVER_ERROR';

      const statusCode =
        errorCode.includes('INVALID') || errorCode.includes('MISSING') ? 400 :
        errorCode.includes('DB_CONNECTION_FAILED') ? 500 :
        500;

      res.status(statusCode).json({ error: errorCode });
    }
  } catch (err) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, hash, create, findFirst, appendFileSync, exec, resolve, reject, error]
 * Description: Processes admin account creation and finalizes installation.
 * Keywords: install, admin, account, setup, post
 */
export const setupAdmin = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'ERR_INSTALL_TOKEN_INVALID_OR_MISSING' });
    return;
  }
  const sessionId = authHeader.replace('Bearer ', '');

  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'ERR_MISSING_REQUIRED_INSTALL_FIELDS' });
    return;
  }

  try {
    const userId = await installationApplicationService.finalizeInstallation(sessionId, username, email, password);

    const tempToken = installationApplicationService.generateTempToken(userId);
    res.cookie('tempToken', tempToken, {
      ...getAuthCookieOptions(60 * 60 * 1000),
      path: '/',
    });

    res.json({ success: true });
  } catch (err: any) {
    const errorCode = typeof err?.message === 'string' && err.message.startsWith('ERR_')
      ? err.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(500).json({ error: errorCode });
  }
};

export const triggerRestart = async (req: Request, res: Response): Promise<void> => {
  const sessionToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.cookies?.installSession;
  if (!sessionToken) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const isValid = await installationApplicationService.verifySessionId(sessionToken);
  if (!isValid) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  res.json({ success: true });
  console.log('Installation restart triggered by client...');
  installationApplicationService.scheduleRestart(500);
};
