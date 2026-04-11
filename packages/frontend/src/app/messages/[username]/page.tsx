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
import { Shield, Loader2, Send, Lock, ArrowLeft, Flame, Trash2, Settings, Clock, Trash, Image as ImageIcon, X } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  ephemeralPublicKey: string;
  encryptedContent: string;
  senderEncryptedContent?: string;
  createdAt: string;
  isRead: boolean;
  isSystem: boolean;
  plaintext?: string;
  sender: { username: string };
  receiver: { username: string };
}


const EncryptedImage = ({ payload, onPreview, dict }: { payload: string, onPreview: (url: string) => void, dict: any }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  
  useEffect(() => {
    const decryptImage = async () => {
      try {
        const data = JSON.parse(payload);
        if (data.type !== 'image') return;
        
        const res = await fetch(data.url);
        const encryptedBuffer = await res.arrayBuffer();
        
        const keyBytes = Uint8Array.from(atob(data.key), c => c.charCodeAt(0));
        const ivBytes = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
        
        const aesKey = await window.crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, encryptedBuffer);
        
        const blob = new Blob([decryptedBuffer], { type: data.mime });
        setBlobUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error('Failed to decrypt image', e);
      }
    };
    decryptImage();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [payload]);

  let pressTimer: any;
  const handleTouchStart = () => { pressTimer = setTimeout(() => setShowMenu(true), 500); };
  const handleTouchEnd = () => { clearTimeout(pressTimer); };

  if (!blobUrl) return <Loader2 className="animate-spin h-5 w-5" />;

  return (
    <div className="relative">
      <img 
        src={blobUrl} 
        alt="Encrypted" 
        className="max-w-[200px] rounded cursor-pointer"
        onClick={() => onPreview(blobUrl)}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
      {showMenu && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover border shadow-lg rounded-lg p-2 z-50 flex flex-col gap-1 min-w-[120px]">
          <button onClick={() => { onPreview(blobUrl); setShowMenu(false); }} className="px-3 py-2 text-sm hover:bg-accent rounded text-left">{dict.messages?.fullScreen || "Full Screen"}</button>
          <a href={blobUrl} download="secure_image" onClick={() => setShowMenu(false)} className="px-3 py-2 text-sm hover:bg-accent rounded text-left block">{dict.messages?.download || "Download"}</a>
          <button onClick={() => setShowMenu(false)} className="px-3 py-2 text-sm hover:bg-accent text-destructive rounded text-left">{dict.common?.cancel || "Cancel"}</button>
        </div>
      )}
    </div>
  );
};

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 3 States
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [allowTwoSidedDelete, setAllowTwoSidedDelete] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Keys
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<CryptoKey | null>(null);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [theirPublicKey, setTheirPublicKey] = useState<CryptoKey | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ isOpen: boolean; message: string; resolve: (value: string | null) => void } | null>(null);
  
  const requestPassword = (message: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPasswordPrompt({ isOpen: true, message, resolve });
    });
  };

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

        // Load conversation settings
        const settingsRes = await fetch(`/api/v1/messages/settings/${targetData.userId}`, { credentials: 'include' });
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setAllowTwoSidedDelete(settingsData.allowTwoSidedDelete);
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
        const fallbackPassword = await requestPassword(dict.messages.enterRecoveryPasswordDesc || 'Please enter your Secure Messaging Recovery Password to unlock your inbox:');
        if (!fallbackPassword) throw new Error(dict.messages.unlockCancelled || 'Unlock cancelled.');
        
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
      
      if (myKeyData.key.publicKey) {
        const pubKey = await importPublicKeyFromBase64(myKeyData.key.publicKey);
        setMyPublicKey(pubKey);
      }

      setMyPrivateKey(privateKey);
      setUnlocked(true);
    } catch (err: any) {
      setError(err.message || 'Failed to unlock messages');
    } finally {
      setUnlocking(false);
    }
  };

  const decryptAllMessages = async () => {
    let needsUpdate = false;
    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      if (msg.plaintext) return msg; // Already decrypted
      needsUpdate = true;
      if (msg.isSystem) return { ...msg, plaintext: msg.encryptedContent };
      try {
        if (msg.senderId === myUserId) {
          if (msg.senderEncryptedContent && myPrivateKey) {
             const ephemeralPublicKey = await importPublicKeyFromBase64(msg.ephemeralPublicKey);
             const decrypted = await decryptMessage(msg.senderEncryptedContent, myPrivateKey, ephemeralPublicKey);
             return { ...msg, plaintext: decrypted };
          }
          return { ...msg, plaintext: '[阅后即焚消息 / Burn-after-reading message]' };
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
    
    if (needsUpdate) {
      setMessages(updatedMessages);
      scrollToBottom();
    }
  };


  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 50 && !isLoadingOlder && hasMore && nextCursor) {
      setIsLoadingOlder(true);
      const previousScrollHeight = scrollContainerRef.current?.scrollHeight || 0;
      
      try {
        const res = await fetch(`/api/v1/messages/inbox?withUserId=${targetUserId}&limit=20&cursor=${nextCursor}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setMessages(prev => [...data.messages, ...prev]);
          setNextCursor(data.nextCursor || null);
          setHasMore(data.hasMore || false);
          
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - previousScrollHeight;
            }
          });
        }
      } finally {
        setIsLoadingOlder(false);
      }
    }
  };

  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !unlocked || !myPrivateKey || !theirPublicKey) return;
    
    setSending(true);
    try {
      // 1. Generate AES key
      const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // 2. Read and Encrypt file
      const arrayBuffer = await file.arrayBuffer();
      const encryptedBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, arrayBuffer);
      
      // 3. Upload encrypted blob
      const formData = new FormData();
      formData.append('file', new Blob([encryptedBuffer]));
      
      const uploadRes = await fetch('/api/v1/messages/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();
      
      // 4. Export keys
      const exportedKey = await window.crypto.subtle.exportKey('raw', aesKey);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
      const ivBase64 = btoa(String.fromCharCode(...iv));
      
      // 5. Send JSON payload
      const payload = JSON.stringify({ type: 'image', url, key: keyBase64, iv: ivBase64, mime: file.type });
      
      const ephemeralKeyPair = await generateECDHKeyPair();
      const ephemeralPublicKeyBase64 = await exportKeyToBase64(ephemeralKeyPair.publicKey);
      const encryptedContent = await encryptMessage(payload, ephemeralKeyPair.privateKey, theirPublicKey);
      
      // Phase 3 required double encryption, check if senderEncryptedContent is needed:
      // The backend expects senderEncryptedContent for the sender's own view if not using the Phase 4 unified DB.
      // Wait, the backend uses ephemeral keys. The sender can't decrypt their own messages later if they don't save the ephemeral key.
      // Actually, my Phase 3 code in page.tsx still has senderEncryptedContent logic!
      const senderEncryptedContent = await encryptMessage(payload, ephemeralKeyPair.privateKey, myPublicKey!);

      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          encryptedContent,
          senderEncryptedContent,
          expiresIn: expiresIn > 0 ? expiresIn : undefined
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { ...data.message, plaintext: payload }]);
        scrollToBottom();
      } else {
        const err = await res.json();
        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        }
        throw new Error(err.error || 'Failed to send image');
      }
    } catch (err: any) {
      setError(err.message || 'Error sending image');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !unlocked || !myPrivateKey || !theirPublicKey || isCoolingDown) return;

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
      
      let senderEncryptedContent = null;
      if (!burnAfterReading && myPublicKey) {
        // Encrypt a copy for ourselves using the same ephemeral private key but OUR public key
        senderEncryptedContent = await encryptMessage(inputText, ephemeralKeyPair.privateKey, myPublicKey);
      }

      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          encryptedContent,
          senderEncryptedContent,
          expiresIn: expiresIn > 0 ? expiresIn : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { ...data.message, plaintext: inputText }]);
        setInputText('');
        scrollToBottom();
      } else {
        const err = await res.json();
        if (err.error === 'ERR_LEVEL_TOO_LOW') {
           throw new Error(dict.messages?.errLevelTooLow || '等级不足，无法发送私信 (Level < 2)');
        } else if (err.error === 'ERR_FRIEND_REQUIRED_LIMIT_REACHED') {
           throw new Error(dict.messages?.errFriendLimit || '非好友最多发送 3 条消息，请先添加好友。');
        }
        throw new Error(err.error || 'Failed to send message');
      }
    } catch (err: any) {
      setError(err.message || dict.messages.sendError);
    } finally {
      setSending(false);
      setIsCoolingDown(true);
      setTimeout(() => setIsCoolingDown(false), 2000);
    }
  };

  const toggleTwoSidedDelete = async () => {
    try {
      const newValue = !allowTwoSidedDelete;
      await fetch(`/api/v1/messages/settings/${targetUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ allowTwoSidedDelete: newValue })
      });
      setAllowTwoSidedDelete(newValue);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`/api/v1/messages/${msgId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearChat = async () => {
    if (!confirm(dict.messages?.confirmClearChat || 'Are you sure you want to clear this chat?')) return;
    try {
      const res = await fetch(`/api/v1/messages/chat/${targetUserId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
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
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-full object-contain" alt="Preview" />
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setPreviewImage(null)}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
            <div className="flex items-center justify-between mb-6 shrink-0"><div className="flex items-center gap-4">
        <Link href="/messages" className="p-2 rounded-full hover:bg-accent/50 text-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold uppercase shrink-0">
          {username.charAt(0)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            {dict.messages.conversationWith?.replace('{username}', username) || `Conversation with ${username}`}
          </h1>
          <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Lock className="h-3 w-3" /> E2E Encrypted
            </div>
          </div>
        </div>

        {unlocked && (
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={handleClearChat}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
              title={dict.messages?.clearChat || "Clear Chat"}
            >
              <Trash className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-muted-foreground hover:bg-accent/50 rounded-full transition-colors"
              title={dict.messages?.conversationSettings || "Settings"}
            >
              <Settings className="h-5 w-5" />
            </button>

            {showSettings && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg p-4 z-50">
                <h3 className="font-semibold mb-3 text-sm">{dict.messages?.conversationSettings || "Conversation Settings"}</h3>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">{dict.messages?.allowTwoSidedDelete || "Allow Two-Sided Delete"}</span>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      checked={allowTwoSidedDelete}
                      onChange={toggleTwoSidedDelete}
                      className={`toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out ${allowTwoSidedDelete ? 'translate-x-full border-green-500' : 'translate-x-0 border-muted'}`}
                    />
                    <label className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${allowTwoSidedDelete ? 'bg-green-500' : 'bg-muted'}`}></label>
                  </div>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  {dict.messages?.allowTwoSidedDeleteDesc?.replace("{username}", username) || `If enabled, when you delete a message, it will also be deleted for ${username}.`}
                </p>
              </div>
            )}
          </div>
        )}
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
          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 relative">
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-10 select-none z-0">
              <p className="text-2xl font-bold text-center transform -rotate-12 text-foreground whitespace-pre-wrap">
                {dict.messages?.legalWarning || 'Safety Tip: Please abide by local laws.\nSending illegal content is strictly prohibited.'}
              </p>
            </div>
            <div className="relative z-10 space-y-4">
              {isLoadingOlder && <div className="text-center p-2"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></div>}
              {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted">
                {dict.messages.noMessages}
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === myUserId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`relative max-w-[75%] rounded-2xl px-4 py-2 ${
                      isMine 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.plaintext?.startsWith('{') && msg.plaintext.includes('"type":"image"') ? (
                          <EncryptedImage payload={msg.plaintext} onPreview={setPreviewImage} dict={dict} />
                        ) : (
                          msg.plaintext || <span className="flex items-center gap-1 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /> Decrypting...</span>
                        )}
                      </p>
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString()} {new Date(msg.createdAt).toLocaleDateString()}
                      </p>
                      
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity ${
                          isMine ? '-left-10' : '-right-10'
                        }`}
                        title={dict.messages?.deleteMessage || "Delete Message"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} className="relative z-10" />
            </div>
          </div>

          <div className="p-4 border-t border-border bg-background/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <select 
                  value={expiresIn} 
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  className="text-xs bg-background border border-border rounded text-muted-foreground focus:ring-1 focus:ring-primary cursor-pointer outline-none px-2 py-1"
                >
                  <option value={0} className="bg-background text-foreground">{dict.messages?.noExpiration || "No Expiration"}</option>
                  <option value={60000} className="bg-background text-foreground">{dict.messages?.oneMinute || "1 Minute"}</option>
                  <option value={3600000} className="bg-background text-foreground">{dict.messages?.oneHour || "1 Hour"}</option>
                  <option value={86400000} className="bg-background text-foreground">{dict.messages?.oneDay || "1 Day"}</option>
                  <option value={604800000} className="bg-background text-foreground">{dict.messages?.oneWeek || "1 Week"}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <input 
                  type="checkbox" 
                  checked={burnAfterReading}
                  onChange={(e) => setBurnAfterReading(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <Flame className="h-3 w-3 text-orange-500" />
                {dict.messages?.burnAfterReading || '阅后即焚 (Burn after reading)'}
              </label>
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform hover:scale-105 shrink-0"
                disabled={sending}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
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

      {passwordPrompt?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg border border-border">
            <h3 className="text-lg font-bold mb-2">{dict.messages.recoveryPasswordTitle || 'Secure Messaging Recovery Password'}</h3>
            <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{passwordPrompt.message}</p>
            <input
              type="password"
              id="recovery-password-input"
              className="w-full rounded-md border border-border bg-background px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={dict.messages.enterPasswordPlaceholder || 'Enter password...'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value;
                  passwordPrompt.resolve(val);
                  setPasswordPrompt(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  passwordPrompt.resolve(null);
                  setPasswordPrompt(null);
                }}
                className="px-4 py-2 rounded-md hover:bg-accent text-sm font-medium transition-colors"
              >
                {dict.common?.cancel || 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const val = (document.getElementById('recovery-password-input') as HTMLInputElement).value;
                  passwordPrompt.resolve(val);
                  setPasswordPrompt(null);
                }}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {dict.common?.confirm || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

