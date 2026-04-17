/**
 * Install Controller
 * Handles the initial setup and installation process of the application.
 */
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { installationApplicationService } from '../registry';

/**
 * Callers: []
 * Callees: [sendFile, join]
 * Description: Serves the tailwind script for the installer.
 * Keywords: install, tailwind, get, route
 */
export const getTailwindScript = (req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../routes/tailwind.js'));
};

/**
 * Callers: []
 * Callees: [send]
 * Description: Serves the installer HTML UI.
 * Keywords: install, ui, get, route, html
 */
export const getInstallHtml = (req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../views/install.html'));
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

    const tempToken = jwt.sign({ userId, type: 'registration' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
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
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const time = new Date();
      try {
        fs.utimesSync(indexPath, time, time);
      } catch (err) {
        fs.closeSync(fs.openSync(indexPath, 'w'));
      }
    }, 1000);

  } catch (err: any) {
    console.error('Admin Creation Error:', err);
    const errorCode = typeof err?.message === 'string' && err.message.startsWith('ERR_')
      ? err.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(500).json({ error: errorCode });
  }
};
