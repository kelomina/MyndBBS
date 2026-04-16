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
};

export type ConversationSettingsDTO = { allowTwoSidedDelete: boolean };
