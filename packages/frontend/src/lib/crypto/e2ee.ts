export const generateECDHKeyPair = async () => {
  return window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-521' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

export const exportKeyToBase64 = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey(key.type === 'public' ? 'spki' : 'pkcs8', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

export const importPublicKeyFromBase64 = async (base64: string): Promise<CryptoKey> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'spki', bytes.buffer as BufferSource, { name: 'ECDH', namedCurve: 'P-521' }, true, []
  );
};

export const importPrivateKeyFromBase64 = async (base64: string): Promise<CryptoKey> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'pkcs8', bytes.buffer as BufferSource, { name: 'ECDH', namedCurve: 'P-521' }, true, ['deriveKey', 'deriveBits']
  );
};

export const getAesKeyFromPrf = async (prfBytes: Uint8Array): Promise<CryptoKey> => {
  return window.crypto.subtle.importKey(
    'raw', prfBytes as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
};

export const encryptPrivateKey = async (privateKeyBase64: string, aesKey: CryptoKey): Promise<string> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, enc.encode(privateKeyBase64)
  );
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
};

export const decryptPrivateKey = async (encryptedBase64: string, aesKey: CryptoKey): Promise<string> => {
  const binaryString = atob(encryptedBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) combined[i] = binaryString.charCodeAt(i);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, aesKey, ciphertext
  );
  return new TextDecoder().decode(decrypted);
};

const deriveAesGcmKey = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> => {
  return window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessage = async (text: string, myPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<string> => {
  const aesKey = await deriveAesGcmKey(myPrivateKey, theirPublicKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(text)
  );
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
};

export const decryptMessage = async (encryptedBase64: string, myPrivateKey: CryptoKey, theirPublicKey: CryptoKey, mlKemSharedSecret?: CryptoKey): Promise<string> => {
  const aesKey = await deriveAesGcmKey(myPrivateKey, theirPublicKey);
  const binaryString = atob(encryptedBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) combined[i] = binaryString.charCodeAt(i);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, aesKey, ciphertext
  );
  return new TextDecoder().decode(decrypted);
};

export const generateMlKem1024KeyPair = async () => { /* Web Crypto API extension or polyfill for ML-KEM */ };
export const encapsulateMlKem1024 = async (publicKey: CryptoKey) => { /* derive sharedSecret2 and ciphertext */ };
export const decapsulateMlKem1024 = async (ciphertext: Uint8Array, privateKey: CryptoKey) => { /* reconstruct sharedSecret2 */ };
