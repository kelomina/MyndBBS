'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../components/TranslationProvider';
import { 
  generateECDHKeyPair, 
  exportKeyToBase64, 
  getAesKeyFromPrf, 
  encryptPrivateKey 
} from '../../lib/crypto/e2ee';
import { startAuthentication } from '@simplewebauthn/browser';
import { Shield, Loader2, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';

interface MessageThread {
  id: string;
  withUser: {
    id: string;
    username: string;
  };
  lastMessage: {
    encryptedContent: string;
    createdAt: string;
    isRead: boolean;
    isSystem: boolean;
    receiverId: string;
    senderId: string;
  };
}

export default function MessagesPage() {
  const dict = useTranslation();
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [error, setError] = useState('');
  const [userLevel, setUserLevel] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const [profileRes, keyRes] = await Promise.all([
        fetch('/api/v1/user/profile', { credentials: 'include' }),
        fetch('/api/v1/messages/keys/me', { credentials: 'include' })
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserLevel(profileData.user.level);
        setCurrentUser(profileData.user);
      }

      if (keyRes.ok) {
        const keyData = await keyRes.json();
        if (keyData.key) {
          setHasKey(true);
          await loadInbox();
        }
      }
    } catch (err) {
      console.error('Failed to load messages status', err);
      setError('Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const loadInbox = async () => {
    try {
      const res = await fetch('/api/v1/messages/inbox', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Group messages by user
        const grouped = new Map<string, any>();
        data.messages.forEach((msg: any) => {
          // Find the other user (not me)
          const isSender = msg.senderId !== msg.receiverId && msg.sender; // Need actual myId, but we can assume we know from context.
          // Wait, backend inbox returns sender and receiver.
          // Better yet, we can group by the other person's ID.
          const otherUser = msg.sender ? msg.sender : msg.receiver; 
          // We need my userId to know who is the other person.
        });
        
        // Wait, the task says "fetch and list inbox conversations (grouped by user)."
        // Let's just show a simple list of unique users we have talked to.
        const threadsMap = new Map<string, MessageThread>();
        // We'll need my user ID. Let's fetch it if we don't have it.
        const profileRes = await fetch('/api/v1/user/profile', { credentials: 'include' });
        const myId = profileRes.ok ? (await profileRes.json()).user.id : '';

        data.messages.forEach((msg: any) => {
          const otherUserId = msg.senderId === myId ? msg.receiverId : msg.senderId;
          const otherUsername = msg.senderId === myId ? msg.receiver.username : msg.sender.username;
          
          if (!threadsMap.has(otherUserId)) {
            threadsMap.set(otherUserId, {
              id: otherUserId,
              withUser: { id: otherUserId, username: otherUsername },
              lastMessage: {
                encryptedContent: msg.encryptedContent,
                createdAt: msg.createdAt,
                isRead: msg.isRead,
                isSystem: msg.isSystem,
                receiverId: msg.receiverId,
                senderId: msg.senderId
              }
            });
          } else {
            // update if newer
            const existing = threadsMap.get(otherUserId)!;
            if (new Date(msg.createdAt) > new Date(existing.lastMessage.createdAt)) {
              existing.lastMessage = {
                encryptedContent: msg.encryptedContent,
                createdAt: msg.createdAt,
                isRead: msg.isRead,
                isSystem: msg.isSystem,
                receiverId: msg.receiverId,
                senderId: msg.senderId
              };
            }
          }
        });

        setThreads(Array.from(threadsMap.values()).sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()));
      }
    } catch (err) {
      console.error('Failed to load inbox', err);
    }
  };

  const handleInitSecureMessaging = async () => {
    setInitializing(true);
    setError('');
    try {
      // 1. Generate Keypair
      const keyPair = await generateECDHKeyPair();
      const publicKeyBase64 = await exportKeyToBase64(keyPair.publicKey);
      const privateKeyBase64 = await exportKeyToBase64(keyPair.privateKey);

      // 2. Start Auth for PRF
      const [optionsRes, passkeysRes] = await Promise.all([
        fetch('/api/v1/auth/passkey/generate-authentication-options', { credentials: 'include' }),
        fetch('/api/v1/user/passkeys', { credentials: 'include' })
      ]);
      if (!optionsRes.ok) throw new Error('Failed to get auth options');
      const optionsData = await optionsRes.json();
      const passkeysData = passkeysRes.ok ? await passkeysRes.json() : { passkeys: [] };

      // Ensure we request PRF extension
      const authOptions = optionsData;
      if (passkeysData.passkeys && passkeysData.passkeys.length > 0) {
        authOptions.allowCredentials = passkeysData.passkeys.map((pk: any) => ({
          id: pk.id,
          type: 'public-key',
          transports: ['internal', 'usb', 'ble', 'nfc']
        }));
      }
      if (!authOptions.extensions) authOptions.extensions = {};
      authOptions.extensions.prf = {
        eval: {
          first: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' // 32 bytes of zeros base64url encoded
        }
      };

      let authResponse;
      try {
        authResponse = await startAuthentication({ optionsJSON: authOptions });
      } catch (err: any) {
        throw new Error(err.message || 'Passkey authentication failed or cancelled.');
      }

      // Extract PRF
      // @ts-ignore
      const prfResults = authResponse.clientExtensionResults?.prf?.results?.first;
      
      let aesKey: CryptoKey;
      
      if (!prfResults) {
        // Fallback Mechanism for authenticators without PRF support
        const fallbackPassword = prompt('Your authenticator does not support the PRF extension natively. \n\nPlease create a Secure Messaging Recovery Password to encrypt your keys. You will need this password to read your messages on other devices.');
        if (!fallbackPassword) throw new Error('Setup cancelled. A recovery password is required when PRF is unavailable.');
        
        // Derive AES key from password using PBKDF2
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw', enc.encode(fallbackPassword), 'PBKDF2', false, ['deriveKey']
        );
        aesKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: enc.encode(currentUser.username + 'MyndBBS'), // Fixed salt based on username
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      } else {
        const prfBytes = new Uint8Array(prfResults);
        aesKey = await getAesKeyFromPrf(prfBytes);
      }

      // 4. Encrypt Private Key
      const encryptedPrivateKey = await encryptPrivateKey(privateKeyBase64, aesKey);

      // 5. Upload
      const uploadRes = await fetch('/api/v1/messages/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scheme: 'P521_ONLY',
          publicKey: publicKeyBase64,
          encryptedPrivateKey
        })
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Failed to upload keys');
      }

      setHasKey(true);
      await loadInbox();
    } catch (err: any) {
      console.error(err);
      setError(err.message || dict.messages.initError);
    } finally {
      setInitializing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (userLevel < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <Shield className="mx-auto h-12 w-12 text-muted mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted">You must be at least Level 2 to use private messages.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          {dict.messages.title}
        </h1>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {!hasKey ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Shield className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">{dict.messages.initSecure}</h2>
          <p className="text-muted mb-6 max-w-md mx-auto">
            {dict.messages.initSecureDesc}
          </p>
          <button
            onClick={handleInitSecureMessaging}
            disabled={initializing}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {initializing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {dict.messages.initializing}</>
            ) : (
              <><Shield className="mr-2 h-4 w-4" /> {dict.messages.initSecure}</>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted">
              {dict.messages.noMessages}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/messages/${thread.withUser.username}`}
                  className="flex items-center justify-between border-b border-border p-4 transition-colors hover:bg-accent/50 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold uppercase">
                      {thread.withUser.username.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{thread.withUser.username}</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Encrypted message • {new Date(thread.lastMessage.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!thread.lastMessage.isRead && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary"></div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
