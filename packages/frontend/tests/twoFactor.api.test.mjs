import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTotp, verifyTotp, verifyTotpLogin, generatePasskeyOptions, verifyPasskeyRegistration, disableTotp } from '../src/lib/api/twoFactor.ts';

test('twoFactor domain service', async (t) => {
  // Mock global fetch
  const originalFetch = global.fetch;

  await t.test('generateTotp calls fetcher with POST', async () => {
    let fetchCalledWith = [];
    global.fetch = async (...args) => {
      fetchCalledWith = args;
      return {
        ok: true,
        json: async () => ({ secret: 'test-secret', qrCodeUrl: 'test-url' })
      };
    };

    const result = await generateTotp('/api/totp/generate');
    
    assert.equal(result.secret, 'test-secret');
    assert.equal(result.qrCodeUrl, 'test-url');
    assert.equal(fetchCalledWith[0].includes('/api/totp/generate'), true);
    assert.equal(fetchCalledWith[1].method, 'POST');
    assert.equal(fetchCalledWith[1].credentials, 'include');
    assert.equal(fetchCalledWith[1].headers['X-Requested-With'], 'XMLHttpRequest');
  });

  await t.test('verifyTotp calls fetcher with POST and code', async () => {
    let fetchCalledWith = [];
    global.fetch = async (...args) => {
      fetchCalledWith = args;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    };

    await verifyTotp('/api/totp/verify', '123456');
    
    assert.equal(fetchCalledWith[0].includes('/api/totp/verify'), true);
    assert.equal(fetchCalledWith[1].method, 'POST');
    assert.equal(fetchCalledWith[1].body, JSON.stringify({ code: '123456' }));
    assert.equal(fetchCalledWith[1].credentials, 'include');
    assert.equal(fetchCalledWith[1].headers['X-Requested-With'], 'XMLHttpRequest');
  });

  await t.test('verifyTotpLogin calls fetcher with POST and code', async () => {
    let fetchCalledWith = [];
    global.fetch = async (...args) => {
      fetchCalledWith = args;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    };

    await verifyTotpLogin('/api/totp/login-verify', '654321');
    
    assert.equal(fetchCalledWith[0].includes('/api/totp/login-verify'), true);
    assert.equal(fetchCalledWith[1].method, 'POST');
    assert.equal(fetchCalledWith[1].body, JSON.stringify({ code: '654321' }));
    assert.equal(fetchCalledWith[1].credentials, 'include');
    assert.equal(fetchCalledWith[1].headers['X-Requested-With'], 'XMLHttpRequest');
  });

  await t.test('disableTotp calls fetcher with POST', async () => {
    let fetchCalledWith = [];
    global.fetch = async (...args) => {
      fetchCalledWith = args;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    };

    await disableTotp('/api/totp/disable');
    
    assert.equal(fetchCalledWith[0].includes('/api/totp/disable'), true);
    assert.equal(fetchCalledWith[1].method, 'POST');
    assert.equal(fetchCalledWith[1].credentials, 'include');
    assert.equal(fetchCalledWith[1].headers['X-Requested-With'], 'XMLHttpRequest');
  });

  await t.test('generatePasskeyOptions calls fetcher with GET (default)', async () => {
    let fetchCalledWith = [];
    global.fetch = async (...args) => {
      fetchCalledWith = args;
      return {
        ok: true,
        json: async () => ({ challengeId: 'test-challenge' })
      };
    };

    const result = await generatePasskeyOptions('/api/passkey/generate-options');
    
    assert.equal(result.challengeId, 'test-challenge');
    assert.equal(fetchCalledWith[0].includes('/api/passkey/generate-options'), true);
    assert.equal(fetchCalledWith[1].credentials, 'include');
    // method is undefined (defaults to GET)
    assert.equal(fetchCalledWith[1].method, undefined);
  });

  await t.test('verifyPasskeyRegistration calls fetcher with POST, response and challengeId', async () => {
    let fetchCalledWith = [];
    global.fetch = async (...args) => {
      fetchCalledWith = args;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    };

    await verifyPasskeyRegistration('/api/passkey/verify', { clientDataJSON: 'test' }, 'challenge-123');
    
    assert.equal(fetchCalledWith[0].includes('/api/passkey/verify'), true);
    assert.equal(fetchCalledWith[1].method, 'POST');
    assert.equal(fetchCalledWith[1].body, JSON.stringify({ response: { clientDataJSON: 'test' }, challengeId: 'challenge-123' }));
    assert.equal(fetchCalledWith[1].credentials, 'include');
    assert.equal(fetchCalledWith[1].headers['X-Requested-With'], 'XMLHttpRequest');
  });

  await t.test('fetcher throws error correctly on failure', async () => {
    global.fetch = async () => {
      return {
        ok: false,
        json: async () => ({ error: 'ERR_CUSTOM_ERROR' })
      };
    };

    try {
      await generateTotp('/api/totp/generate');
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.equal(err.message, 'ERR_CUSTOM_ERROR');
    }
  });

  // Restore global fetch
  global.fetch = originalFetch;
});
