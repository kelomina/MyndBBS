'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from '../../../components/TranslationProvider';
import { 
  importPublicKeyFromBase64,
  importPrivateKeyFromBase64,
  getAesKeyFromPrf,
  decryptPrivateKey,
  encryptMessage,
  decryptMessage,
  generateECDHKeyPair,
  exportKeyToBase64
} from '../../../lib/crypto/e2ee';
import { startAuthentication } from '@simplewebauthn/browser';
import { Shield, Loader2, Send, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  ephemeralPublicKey: string;
  encryptedContent: string;
  createdAt: string;
  isRead: boolean;
  plaintext?: string;
  sender: { username: string };
  receiver: { username: string };
}

export default function ChatPage({ params }: { params: Promise<{ username: string }> }) {
  const dict = useTranslation();
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keys
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [theirPublicKey, setTheirPublicKey] = useState<CryptoKey | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    params.then(p => {
      setUsername(p.username);
      loadInitialData(p.username);
    });
  }, [params]);

  useEffect(() => {
    if (unlocked && myPrivateKey && theirPublicKey && messages.length > 0) {
      decryptAllMessages();
    }
  }, [unlocked, myPrivateKey, theirPublicKey, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadInitialData = async (targetUsername: string) => {
    try {
      const [profileRes, targetKeyRes] = await Promise.all([
        fetch('/api/v1/user/profile', { credentials: 'include' }),
        fetch(`/api/v1/messages/keys/${targetUsername}`, { credentials: 'include' })
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setMyUserId(profileData.user.id);
      setCurrentUser(profileData.user);
      }

      if (targetKeyRes.ok) {
        const targetData = await targetKeyRes.json();
        setTargetUserId(targetData.userId);
        const importedTheirKey = await importPublicKeyFromBase64(targetData.publicKey);
        setTheirPublicKey(importedTheirKey);

        // Load messages history
        const inboxRes = await fetch(`/api/v1/messages/inbox?withUserId=${targetData.userId}`, { credentials: 'include' });
        if (inboxRes.ok) {
          const inboxData = await inboxRes.json();
          setMessages(inboxData.messages);
          scrollToBottom();
        }
      } else {
        setError(`User ${targetUsername} has not initialized secure messaging.`);
      }
    } catch (err) {
      setError('Failed to load chat data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    setUnlocking(true);
    setError('');
    try {
      // Fetch my encrypted private key
      const myKeyRes = await fetch('/api/v1/messages/keys/me', { credentials: 'include' });
      if (!myKeyRes.ok) throw new Error('Failed to fetch your keys. Please initialize secure messaging first.');
      const myKeyData = await myKeyRes.json();

      if (!myKeyData.key) {
        throw new Error('You have not initialized secure messaging.');
      }

      // Start auth for PRF
      const [optionsRes, passkeysRes] = await Promise.all([
        fetch('/api/v1/auth/passkey/generate-authentication-options', { credentials: 'include' }),
        fetch('/api/v1/user/passkeys', { credentials: 'include' })
      ]);
      if (!optionsRes.ok) throw new Error('Failed to get auth options');
      const optionsData = await optionsRes.json();
      const passkeysData = passkeysRes.ok ? await passkeysRes.json() : { passkeys: [] };

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
          first: new Uint8Array(32) // Use same salt as registration
        }
      };

      let authResponse;
      try {
        authResponse = await startAuthentication({ optionsJSON: authOptions });
      } catch (err: any) {
        throw new Error(err.message || 'Authentication failed or cancelled.');
      }

      // Extract PRF
      // @ts-ignore
      const prfResults = authResponse.clientExtensionResults?.prf?.results?.first;
      
      let aesKey: CryptoKey;

      if (!prfResults) {
        // Fallback Mechanism
        const fallbackPassword = prompt('Please enter your Secure Messaging Recovery Password to unlock your inbox:');
        if (!fallbackPassword) throw new Error('Unlock cancelled.');
        
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw', enc.encode(fallbackPassword), 'PBKDF2', false, ['deriveKey']
        );
        aesKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: enc.encode(currentUser.username + 'MyndBBS'), // Must match initialization salt
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

      // Decrypt private key
      const privateKeyBase64 = await decryptPrivateKey(myKeyData.key.encryptedPrivateKey, aesKey);
      const privateKey = await importPrivateKeyFromBase64(privateKeyBase64);
      
      setMyPrivateKey(privateKey);
      setUnlocked(true);
    } catch (err: any) {
      setError(err.message || 'Failed to unlock messages');
    } finally {
      setUnlocking(false);
    }
  };

  const decryptAllMessages = async () => {
    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      if (msg.plaintext) return msg; // Already decrypted
      try {
        if (msg.senderId === myUserId) {
          // We are the sender. We used an ephemeral private key to encrypt this, which we didn't save.
          // Therefore, we cannot decrypt our own sent messages from the server's ciphertext.
          return { ...msg, plaintext: '[Sent Encrypted Message]' };
        } else {
          // We are the receiver. We use our static private key and the sender's ephemeral public key.
          const ephemeralPublicKey = await importPublicKeyFromBase64(msg.ephemeralPublicKey);
          const decrypted = await decryptMessage(msg.encryptedContent, myPrivateKey!, ephemeralPublicKey);
          return { ...msg, plaintext: decrypted };
        }
      } catch (err) {
        console.error('Failed to decrypt message', msg.id, err);
        return { ...msg, plaintext: '[Decryption Failed]' };
      }
    }));
    
    setMessages(updatedMessages);
    scrollToBottom();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !unlocked || !myPrivateKey || !theirPublicKey) return;

    setSending(true);
    try {
      // Ephemeral key pair as required by plan:
      // "On Send: generate ephemeral keypair, encryptMessage() with target's public key, POST to /api/v1/messages."
      // Actually wait, if we generate ephemeral keypair for each message, how does the receiver know it?
      // The schema has ephemeralPublicKey.
      const ephemeralKeyPair = await generateECDHKeyPair();
      const ephemeralPublicKeyBase64 = await exportKeyToBase64(ephemeralKeyPair.publicKey);
      
      // We encrypt using ephemeral private key and their public key
      const encryptedContent = await encryptMessage(inputText, ephemeralKeyPair.privateKey, theirPublicKey);

      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          encryptedContent
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { ...data.message, plaintext: inputText }]);
        setInputText('');
        scrollToBottom();
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err: any) {
      setError(err.message || dict.messages.sendError);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <Link href="/messages" className="p-2 rounded-full hover:bg-accent/50 text-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold uppercase shrink-0">
          {username.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {dict.messages.conversationWith?.replace('{username}', username) || `Conversation with ${username}`}
          </h1>
          <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <Lock className="h-3 w-3" /> E2E Encrypted
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 shrink-0 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {!unlocked && !error && targetUserId && (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Shield className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">{dict.messages.unlockMessages}</h2>
          <p className="text-muted mb-6 max-w-md mx-auto">
            {dict.messages.authRequired}
          </p>
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {unlocking ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {dict.messages.decrypting}</>
            ) : (
              <><Lock className="mr-2 h-4 w-4" /> {dict.messages.unlockMessages}</>
            )}
          </button>
        </div>
      )}

      {unlocked && (
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted">
                {dict.messages.noMessages}
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === myUserId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isMine 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>}
                      </p>
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString()} {new Date(msg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border bg-background/50">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={dict.messages.typeMessage}
                className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -ml-0.5" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
