export type MessageThread = {
  id: string;
  withUser: {
    id: string;
    username: string;
  };
  lastMessage: {
    encryptedContent: string;
    createdAt: string;
    isRead: boolean;
  };
};

export type InboxMessage = {
  senderId: string;
  receiverId: string;
  encryptedContent: string;
  createdAt: string;
  isRead: boolean;
  sender: { username: string };
  receiver: { username: string };
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
  plaintext?: string;
  sender: { username: string };
  receiver: { username: string };
};
