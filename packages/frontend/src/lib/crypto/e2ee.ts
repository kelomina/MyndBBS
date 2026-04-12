import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
/**
 * Callers: []
 * Callees: [generateKey]
 * Description: Handles the generate e c d h key pair logic for the application.
 * Keywords: generateecdhkeypair, generate, e, c, d, h, key, pair, auto-annotated
 */
export const generateECDHKeyPair = async () => {
  return window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-521' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

/**
 * Callers: []
 * Callees: [exportKey, btoa, fromCharCode]
 * Description: Handles the export key to base64 logic for the application.
 * Keywords: exportkeytobase64, export, key, to, base64, auto-annotated
 */
export const exportKeyToBase64 = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey(key.type === 'public' ? 'spki' : 'pkcs8', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

/**
 * Callers: []
 * Callees: [atob, charCodeAt, importKey]
 * Description: Handles the import public key from base64 logic for the application.
 * Keywords: importpublickeyfrombase64, import, public, key, from, base64, auto-annotated
 */
export const importPublicKeyFromBase64 = async (base64: string): Promise<CryptoKey> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'spki', bytes.buffer as BufferSource, { name: 'ECDH', namedCurve: 'P-521' }, true, []
  );
};

/**
 * Callers: []
 * Callees: [atob, charCodeAt, importKey]
 * Description: Handles the import private key from base64 logic for the application.
 * Keywords: importprivatekeyfrombase64, import, private, key, from, base64, auto-annotated
 */
export const importPrivateKeyFromBase64 = async (base64: string): Promise<CryptoKey> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'pkcs8', bytes.buffer as BufferSource, { name: 'ECDH', namedCurve: 'P-521' }, true, ['deriveKey', 'deriveBits']
  );
};

/**
 * Callers: []
 * Callees: [importKey]
 * Description: Handles the get aes key from prf logic for the application.
 * Keywords: getaeskeyfromprf, get, aes, key, from, prf, auto-annotated
 */
export const getAesKeyFromPrf = async (prfBytes: Uint8Array): Promise<CryptoKey> => {
  return window.crypto.subtle.importKey(
    'raw', prfBytes as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
};

/**
 * Callers: []
 * Callees: [getRandomValues, encrypt, encode, set, btoa, fromCharCode]
 * Description: Handles the encrypt private key logic for the application.
 * Keywords: encryptprivatekey, encrypt, private, key, auto-annotated
 */
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

/**
 * Callers: []
 * Callees: [atob, charCodeAt, slice, decrypt, decode]
 * Description: Handles the decrypt private key logic for the application.
 * Keywords: decryptprivatekey, decrypt, private, key, auto-annotated
 */
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

/**
 * Callers: []
 * Callees: [deriveBits, set, importKey, deriveKey, encode]
 * Description: Handles the derive aes gcm key logic for the application.
 * Keywords: deriveaesgcmkey, derive, aes, gcm, key, auto-annotated
 */
const deriveAesGcmKey = async (privateKey: CryptoKey, publicKey: CryptoKey, mlKemSharedSecret?: Uint8Array): Promise<CryptoKey> => {
  // Derive P-521 shared secret bits
  const p521SecretBits = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    528 // bits for P-521
  );

  let combinedMaterial: Uint8Array;
  
  if (mlKemSharedSecret) {
    // X-Wing hybrid: Combine P-521 and ML-KEM-1024 shared secrets
    const p521Bytes = new Uint8Array(p521SecretBits);
    combinedMaterial = new Uint8Array(p521Bytes.length + mlKemSharedSecret.length);
    combinedMaterial.set(p521Bytes, 0);
    combinedMaterial.set(mlKemSharedSecret, p521Bytes.length);
  } else {
    combinedMaterial = new Uint8Array(p521SecretBits);
  }

  // Use HKDF to derive the final AES-GCM key
  const baseKey = await window.crypto.subtle.importKey(
    'raw', combinedMaterial as BufferSource, 'HKDF', false, ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode('MyndBBS-E2EE-v1')
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Callers: []
 * Callees: [deriveAesGcmKey, getRandomValues, encrypt, encode, set, btoa, fromCharCode]
 * Description: Handles the encrypt message logic for the application.
 * Keywords: encryptmessage, encrypt, message, auto-annotated
 */
export const encryptMessage = async (text: string, myPrivateKey: CryptoKey, theirPublicKey: CryptoKey, mlKemSharedSecret?: Uint8Array): Promise<string> => {
  const aesKey = await deriveAesGcmKey(myPrivateKey, theirPublicKey, mlKemSharedSecret);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(text)
  );
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
};

/**
 * Callers: []
 * Callees: [deriveAesGcmKey, atob, charCodeAt, slice, decrypt, decode]
 * Description: Handles the decrypt message logic for the application.
 * Keywords: decryptmessage, decrypt, message, auto-annotated
 */
export const decryptMessage = async (encryptedBase64: string, myPrivateKey: CryptoKey, theirPublicKey: CryptoKey, mlKemSharedSecret?: Uint8Array): Promise<string> => {
  const aesKey = await deriveAesGcmKey(myPrivateKey, theirPublicKey, mlKemSharedSecret);
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

/**
 * Callers: []
 * Callees: [keygen, btoa, fromCharCode]
 * Description: Handles the generate ml kem1024 key pair logic for the application.
 * Keywords: generatemlkem1024keypair, generate, ml, kem1024, key, pair, auto-annotated
 */
export const generateMlKem1024KeyPair = async () => {
  const keys = ml_kem1024.keygen();
  return {
    publicKeyBase64: btoa(String.fromCharCode(...keys.publicKey)),
    privateKeyBase64: btoa(String.fromCharCode(...keys.secretKey))
  };
};
/**
 * Callers: []
 * Callees: [atob, charCodeAt, encapsulate, btoa, fromCharCode]
 * Description: Handles the encapsulate ml kem1024 logic for the application.
 * Keywords: encapsulatemlkem1024, encapsulate, ml, kem1024, auto-annotated
 */
export const encapsulateMlKem1024 = async (publicKeyBase64: string) => {
  const binaryString = atob(publicKeyBase64);
  const publicKeyBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) publicKeyBytes[i] = binaryString.charCodeAt(i);
  
  const { cipherText, sharedSecret } = ml_kem1024.encapsulate(publicKeyBytes);
  
  return {
    sharedSecret2: sharedSecret,
    ciphertextBase64: btoa(String.fromCharCode(...cipherText))
  };
};
/**
 * Callers: []
 * Callees: [atob, charCodeAt, decapsulate]
 * Description: Handles the decapsulate ml kem1024 logic for the application.
 * Keywords: decapsulatemlkem1024, decapsulate, ml, kem1024, auto-annotated
 */
export const decapsulateMlKem1024 = async (ciphertextBase64: string, privateKeyBase64: string) => {
  const ctStr = atob(ciphertextBase64);
  const ctBytes = new Uint8Array(ctStr.length);
  for (let i = 0; i < ctStr.length; i++) ctBytes[i] = ctStr.charCodeAt(i);
  
  const pkStr = atob(privateKeyBase64);
  const pkBytes = new Uint8Array(pkStr.length);
  for (let i = 0; i < pkStr.length; i++) pkBytes[i] = pkStr.charCodeAt(i);
  
  return ml_kem1024.decapsulate(ctBytes, pkBytes);
};
