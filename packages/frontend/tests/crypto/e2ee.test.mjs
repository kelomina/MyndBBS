/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import assert from 'node:assert/strict';
import test from 'node:test';

const mockCrypto = {
  subtle: {
    generateKey: async (algorithm, extractable, keyUsages) => {
      if (algorithm.name === 'ECDH') {
        const keyPair = {
          publicKey: { type: 'public', algorithm: { name: 'ECDH', namedCurve: 'P-521' } },
          privateKey: { type: 'private', algorithm: { name: 'ECDH', namedCurve: 'P-521' } },
        };
        return keyPair;
      }
      throw new Error(`Unsupported algorithm: ${algorithm.name}`);
    },
    exportKey: async (format, key) => {
      if (format === 'spki' || format === 'pkcs8') {
        return new Uint8Array(32).fill(0x41);
      }
      if (format === 'raw') {
        return new Uint8Array(32).fill(0x42);
      }
      throw new Error(`Unsupported format: ${format}`);
    },
    importKey: async (format, keyData, algorithm, extractable, keyUsages) => {
      if (format === 'spki') {
        return { type: 'public', algorithm };
      }
      if (format === 'pkcs8') {
        return { type: 'private', algorithm };
      }
      if (format === 'raw') {
        return { type: 'raw', algorithm };
      }
      throw new Error(`Unsupported format: ${format}`);
    },
    deriveBits: async (algorithm, baseKey, length) => {
      return new Uint8Array(Math.ceil(length / 8)).fill(0x43);
    },
    deriveKey: async (algorithm, baseKey, derivedKeyType, extractable, keyUsages) => {
      return { type: 'derived', algorithm: derivedKeyType };
    },
    encrypt: async (algorithm, key, data) => {
      const iv = new Uint8Array(12).fill(0x44);
      return new Uint8Array(iv.length + data.byteLength);
    },
    decrypt: async (algorithm, key, data) => {
      const iv = new Uint8Array(12);
      const ciphertext = data.slice(12);
      return new Uint8Array(100);
    },
  },
  getRandomValues: (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = i % 256;
    }
    return array;
  },
};

globalThis.window = { crypto: mockCrypto } as any;

test('exportKeyToBase64 should export public key correctly', async () => {
  const { exportKeyToBase64 } = await import('../src/lib/crypto/e2ee.ts');
  const mockKey = { type: 'public', algorithm: { name: 'ECDH', namedCurve: 'P-521' } };
  const result = await exportKeyToBase64(mockKey as any);
  assert.ok(typeof result === 'string');
  assert.ok(result.length > 0);
});

test('generateECDHKeyPair should generate a key pair', async () => {
  const { generateECDHKeyPair } = await import('../src/lib/crypto/e2ee.ts');
  const keyPair = await generateECDHKeyPair();
  assert.ok(keyPair.publicKey);
  assert.ok(keyPair.privateKey);
});

test('getAesKeyFromPrf should import AES key from PRF bytes', async () => {
  const { getAesKeyFromPrf } = await import('../src/lib/crypto/e2ee.ts');
  const prfBytes = new Uint8Array(32);
  const aesKey = await getAesKeyFromPrf(prfBytes);
  assert.ok(aesKey);
});

test('encryptPrivateKey should encrypt a private key', async () => {
  const { encryptPrivateKey } = await import('../src/lib/crypto/e2ee.ts');
  const privateKey = 'test-private-key-base64';
  const mockAesKey = { type: 'aes', algorithm: { name: 'AES-GCM' } };
  const result = await encryptPrivateKey(privateKey, mockAesKey as any);
  assert.ok(typeof result === 'string');
  assert.ok(result.length > 0);
});

test('decryptPrivateKey should decrypt an encrypted private key', async () => {
  const { decryptPrivateKey } = await import('../src/lib/crypto/e2ee.ts');
  const mockAesKey = { type: 'aes', algorithm: { name: 'AES-GCM' } };
  const encryptedBase64 = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=';
  const result = await decryptPrivateKey(encryptedBase64, mockAesKey as any);
  assert.ok(typeof result === 'string');
});

test('encryptMessage should encrypt a message', async () => {
  const { encryptMessage, generateECDHKeyPair } = await import('../src/lib/crypto/e2ee.ts');
  const myKeyPair = await generateECDHKeyPair();
  const theirKeyPair = await generateECDHKeyPair();
  const result = await encryptMessage('Test message', myKeyPair.privateKey, theirKeyPair.publicKey);
  assert.ok(typeof result === 'string');
  assert.ok(result.length > 0);
});

test('decryptMessage should decrypt an encrypted message', async () => {
  const { encryptMessage, decryptMessage, generateECDHKeyPair } = await import('../src/lib/crypto/e2ee.ts');
  const myKeyPair = await generateECDHKeyPair();
  const theirKeyPair = await generateECDHKeyPair();
  const message = 'Test message to encrypt';
  const encrypted = await encryptMessage(message, myKeyPair.privateKey, theirKeyPair.publicKey);
  const decrypted = await decryptMessage(encrypted, myKeyPair.privateKey, theirKeyPair.publicKey);
  assert.ok(typeof decrypted === 'string');
});

test('encrypt/decrypt with ML-KEM hybrid should work', async () => {
  const { encryptMessage, decryptMessage, generateECDHKeyPair } = await import('../src/lib/crypto/e2ee.ts');
  const myKeyPair = await generateECDHKeyPair();
  const theirKeyPair = await generateECDHKeyPair();
  const mlKemSharedSecret = new Uint8Array(32).fill(0x45);
  const message = 'Test message with hybrid encryption';
  const encrypted = await encryptMessage(message, myKeyPair.privateKey, theirKeyPair.publicKey, mlKemSharedSecret);
  const decrypted = await decryptMessage(encrypted, myKeyPair.privateKey, theirKeyPair.publicKey, mlKemSharedSecret);
  assert.ok(typeof decrypted === 'string');
});

test('generateMlKem1024KeyPair should generate key pair', async () => {
  const { generateMlKem1024KeyPair } = await import('../src/lib/crypto/e2ee.ts');
  const keyPair = await generateMlKem1024KeyPair();
  assert.ok(keyPair.publicKeyBase64);
  assert.ok(keyPair.privateKeyBase64);
  assert.ok(keyPair.publicKeyBase64.length > 0);
  assert.ok(keyPair.privateKeyBase64.length > 0);
});

test('encapsulateMlKem1024 should encapsulate shared secret', async () => {
  const { generateMlKem1024KeyPair, encapsulateMlKem1024 } = await import('../src/lib/crypto/e2ee.ts');
  const keyPair = await generateMlKem1024KeyPair();
  const result = await encapsulateMlKem1024(keyPair.publicKeyBase64);
  assert.ok(result.sharedSecret2);
  assert.ok(result.ciphertextBase64);
  assert.ok(result.sharedSecret2.length === 32);
  assert.ok(result.ciphertextBase64.length > 0);
});

test('decapsulateMlKem1024 should decapsulate shared secret', async () => {
  const { generateMlKem1024KeyPair, encapsulateMlKem1024, decapsulateMlKem1024 } = await import('../src/lib/crypto/e2ee.ts');
  const keyPair = await generateMlKem1024KeyPair();
  const encapsulated = await encapsulateMlKem1024(keyPair.publicKeyBase64);
  const sharedSecret = await decapsulateMlKem1024(encapsulated.ciphertextBase64, keyPair.privateKeyBase64);
  assert.ok(sharedSecret);
  assert.ok(sharedSecret.length === 32);
});

test('encapsulate/decapsulate should produce same shared secret', async () => {
  const { generateMlKem1024KeyPair, encapsulateMlKem1024, decapsulateMlKem1024 } = await import('../src/lib/crypto/e2ee.ts');
  const keyPair = await generateMlKem1024KeyPair();
  const encapsulated = await encapsulateMlKem1024(keyPair.publicKeyBase64);
  const sharedSecret = await decapsulateMlKem1024(encapsulated.ciphertextBase64, keyPair.privateKeyBase64);
  const sharedSecretHex = Buffer.from(sharedSecret).toString('hex');
  const expectedHex = Buffer.from(encapsulated.sharedSecret2).toString('hex');
  assert.equal(sharedSecretHex, expectedHex);
});

test('importPublicKeyFromBase64 should import a public key', async () => {
  const { importPublicKeyFromBase64 } = await import('../src/lib/crypto/e2ee.ts');
  const base64Key = Buffer.from('test-public-key-data').toString('base64');
  const key = await importPublicKeyFromBase64(base64Key);
  assert.ok(key);
});

test('importPrivateKeyFromBase64 should import a private key', async () => {
  const { importPrivateKeyFromBase64 } = await import('../src/lib/crypto/e2ee.ts');
  const base64Key = Buffer.from('test-private-key-data').toString('base64');
  const key = await importPrivateKeyFromBase64(base64Key);
  assert.ok(key);
});

test('encryption should produce different outputs due to random IV', async () => {
  const { encryptMessage, generateECDHKeyPair } = await import('../src/lib/crypto/e2ee.ts');
  const myKeyPair = await generateECDHKeyPair();
  const theirKeyPair = await generateECDHKeyPair();
  const message = 'Same message';

  const encrypted1 = await encryptMessage(message, myKeyPair.privateKey, theirKeyPair.publicKey);
  const encrypted2 = await encryptMessage(message, myKeyPair.privateKey, theirKeyPair.publicKey);

  assert.notEqual(encrypted1, encrypted2);
});

test('encrypt/decrypt round-trip should preserve message', async () => {
  const { encryptMessage, decryptMessage, generateECDHKeyPair, exportKeyToBase64, importPublicKeyFromBase64, importPrivateKeyFromBase64, getAesKeyFromPrf, encryptPrivateKey, decryptPrivateKey } = await import('../src/lib/crypto/e2ee.ts');

  const myKeyPair = await generateECDHKeyPair();
  const theirKeyPair = await generateECDHKeyPair();

  const myPublicKeyBase64 = await exportKeyToBase64(myKeyPair.publicKey);
  const myPrivateKeyBase64 = await exportKeyToBase64(myKeyPair.privateKey);
  const theirPublicKeyBase64 = await exportKeyToBase64(theirKeyPair.publicKey);

  const importedMyPrivateKey = await importPrivateKeyFromBase64(myPrivateKeyBase64);
  const importedTheirPublicKey = await importPublicKeyFromBase64(theirPublicKeyBase64);

  const originalMessage = 'Hello, World! This is a test message with special chars: 你好 🎉';
  const encrypted = await encryptMessage(originalMessage, importedMyPrivateKey, importedTheirPublicKey);
  const decrypted = await decryptMessage(encrypted, importedMyPrivateKey, importedTheirPublicKey);

  assert.equal(decrypted, originalMessage);
});
