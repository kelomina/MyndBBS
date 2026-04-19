export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

export interface FriendshipProps {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
}

/**
 * Callers: [PrismaFriendshipRepository, MessagingApplicationService]
 * Callees: []
 * Description: Represents a Friendship Aggregate Root in the Messaging domain. Manages the state machine of a friend request.
 * Keywords: friendship, aggregate, root, domain, entity, messaging, friend
 */
export class Friendship {
  private props: FriendshipProps;

  /**
   * Callers: [Friendship.create, PrismaFriendshipRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, friendship, entity, instantiation
   */
  private constructor(props: FriendshipProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaFriendshipRepository, MessagingApplicationService]
   * Callees: [Friendship.constructor]
   * Description: Static factory method creating a new pending Friendship entity.
   * Keywords: create, factory, friendship, domain, instantiation
   */
  public static create(props: FriendshipProps): Friendship {
    if (props.requesterId === props.addresseeId) {
      throw new Error('ERR_CANNOT_ADD_SELF_AS_FRIEND');
    }
    return new Friendship(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get requesterId(): string { return this.props.requesterId; }
  public get addresseeId(): string { return this.props.addresseeId; }
  public get status(): FriendshipStatus { return this.props.status; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [MessagingApplicationService.acceptFriendRequest]
   * Callees: []
   * Description: Accepts a pending friend request.
   * Keywords: accept, friend, request, friendship, messaging
   */
  public accept(userId: string): void {
    if (this.props.addresseeId !== userId) {
      throw new Error('ERR_FORBIDDEN_NOT_ADDRESSEE');
    }
    if (this.props.status !== 'PENDING') {
      throw new Error('ERR_FRIENDSHIP_NOT_PENDING');
    }
    this.props.status = 'ACCEPTED';
  }

  /**
   * Callers: [MessagingApplicationService.rejectFriendRequest]
   * Callees: []
   * Description: Rejects a pending friend request.
   * Keywords: reject, friend, request, friendship, messaging
   */
  public reject(userId: string): void {
    if (this.props.addresseeId !== userId) {
      throw new Error('ERR_FORBIDDEN_NOT_ADDRESSEE');
    }
    if (this.props.status !== 'PENDING') {
      throw new Error('ERR_FRIENDSHIP_NOT_PENDING');
    }
    this.props.status = 'REJECTED';
  }

  /**
   * Callers: [MessagingApplicationService.blockUser]
   * Callees: []
   * Description: Blocks the other user in this friendship. The blocker becomes the requester.
   * Keywords: block, friend, user, friendship, messaging
   */
  public block(blockerId: string): void {
    if (this.props.requesterId !== blockerId && this.props.addresseeId !== blockerId) {
      throw new Error('ERR_FORBIDDEN_NOT_INVOLVED');
    }
    const blockedId = this.props.requesterId === blockerId ? this.props.addresseeId : this.props.requesterId;
    this.props.requesterId = blockerId;
    this.props.addresseeId = blockedId;
    this.props.status = 'BLOCKED';
  }
}