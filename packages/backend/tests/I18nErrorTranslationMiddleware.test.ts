import express from 'express';
import http from 'node:http';
import { i18nErrorTranslationMiddleware } from '../src/middleware/i18nErrorTranslation';

const startServer = async (app: express.Express): Promise<{ baseUrl: string; close: () => Promise<void> }> => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('ERR_TEST_SERVER_ADDRESS_UNAVAILABLE');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
};

describe('i18nErrorTranslationMiddleware', () => {
  it('adds zh message for known ERR_ codes', async () => {
    const app = express();
    app.use(i18nErrorTranslationMiddleware);
    app.get('/err', (req, res) => res.status(400).json({ error: 'ERR_MISSING_DATABASE_URL' }));

    const { baseUrl, close } = await startServer(app);
    try {
      const res = await fetch(`${baseUrl}/err`, { headers: { 'x-locale': 'zh' } });
      const body = await res.json();
      expect(body).toEqual({ error: 'ERR_MISSING_DATABASE_URL', message: '缺少 DATABASE_URL' });
    } finally {
      await close();
    }
  });

  it('adds en message for known ERR_ codes', async () => {
    const app = express();
    app.use(i18nErrorTranslationMiddleware);
    app.get('/err', (req, res) => res.status(400).json({ error: 'ERR_MISSING_DATABASE_URL' }));

    const { baseUrl, close } = await startServer(app);
    try {
      const res = await fetch(`${baseUrl}/err`, { headers: { 'x-locale': 'en' } });
      const body = await res.json();
      expect(body).toEqual({ error: 'ERR_MISSING_DATABASE_URL', message: 'Missing DATABASE_URL' });
    } finally {
      await close();
    }
  });

  it('falls back to error code when translation is missing', async () => {
    const app = express();
    app.use(i18nErrorTranslationMiddleware);
    app.get('/err', (req, res) => res.status(400).json({ error: 'ERR_SOME_UNKNOWN_CODE' }));

    const { baseUrl, close } = await startServer(app);
    try {
      const res = await fetch(`${baseUrl}/err`, { headers: { 'x-locale': 'zh' } });
      const body = await res.json();
      expect(body).toEqual({ error: 'ERR_SOME_UNKNOWN_CODE', message: 'ERR_SOME_UNKNOWN_CODE' });
    } finally {
      await close();
    }
  });

  it('does not overwrite an existing message', async () => {
    const app = express();
    app.use(i18nErrorTranslationMiddleware);
    app.get('/err', (req, res) => res.status(400).json({ error: 'ERR_BAD_REQUEST', message: 'custom' }));

    const { baseUrl, close } = await startServer(app);
    try {
      const res = await fetch(`${baseUrl}/err`, { headers: { 'x-locale': 'zh' } });
      const body = await res.json();
      expect(body).toEqual({ error: 'ERR_BAD_REQUEST', message: 'custom' });
    } finally {
      await close();
    }
  });
});

