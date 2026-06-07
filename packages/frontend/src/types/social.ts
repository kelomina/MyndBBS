export type FriendshipUser = { id: string; username: string };
export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  requester: FriendshipUser;
  addressee: FriendshipUser;
};
