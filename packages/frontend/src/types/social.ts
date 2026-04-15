export type FriendshipUser = { username: string };
export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requester: FriendshipUser;
  addressee: FriendshipUser;
};
