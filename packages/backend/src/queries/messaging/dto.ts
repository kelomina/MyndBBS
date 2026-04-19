export type InboxDTO = {
  partnerId: string;
  partnerUsername: string;
  lastMessageAt: Date | null;
  unreadCount: number;
};

export type FriendshipDTO = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  createdAt: Date;
  requester: { id: string; username: string };
  addressee: { id: string; username: string };
};

export type ConversationSettingsDTO = { allowTwoSidedDelete: boolean };

export type UserKeyDTO = {
  id: string;
  userId: string;
  scheme: string;
  publicKey: string;
  encryptedPrivateKey: string;
  mlKemPublicKey: string | null;
  encryptedMlKemPrivateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserPublicKeyDTO = {
  id: string;
  username: string;
  userKey: UserKeyDTO | null;
};

export type PrivateMessageDTO = {
  id: string;
  senderId: string;
  receiverId: string;
  ephemeralPublicKey: string;
  ephemeralMlKemCiphertext: string | null;
  encryptedContent: string;
  senderEncryptedContent: string | null;
  isRead: boolean;
  isSystem: boolean;
  expiresAt: Date | null;
  deletedBy: string[];
  createdAt: Date;
  updatedAt: Date;
  sender: { username: string };
  receiver: { username: string };
};

export type MessageListDTO = {
  messages: PrivateMessageDTO[];
  nextCursor: string | undefined;
  hasMore: boolean;
};

