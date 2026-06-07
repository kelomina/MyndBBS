export type MessageThread = {
  id: string;
  withUser: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  lastMessage: {
    encryptedContent: string;
    createdAt: string;
    isRead: boolean;
    previewText?: string;
  };
};

export type InboxMessage = {
  senderId: string;
  receiverId: string;
  encryptedContent: string;
  createdAt: string;
  isRead: boolean;
  isSystem?: boolean;
  sender: { username: string; avatarUrl?: string | null };
  receiver: { username: string; avatarUrl?: string | null };
};

export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  ephemeralPublicKey: string;
  encryptedContent: string;
  senderEncryptedContent?: string;
  createdAt: string;
  isRead: boolean;
  isSystem: boolean;
  isTimedMessage?: boolean;
  expiresAt?: string | null;
  expiresInMs?: number | null;
  expiresStartedAt?: string | null;
  autoDeleteForSenderAfterRead?: boolean;
  autoDeleteForSelf?: boolean;
  deletedBy?: string[];
  plaintext?: string;
  sender: { username: string; avatarUrl?: string | null };
  receiver: { username: string; avatarUrl?: string | null };
};
