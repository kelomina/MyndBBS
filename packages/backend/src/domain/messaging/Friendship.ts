export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

export interface FriendshipProps {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
}

/**
 * 类名称：Friendship
 *
 * 函数作用：
 *   私信域中的好友关系聚合根。管理好友请求状态机（PENDING→ACCEPTED/REJECTED/BLOCKED）。
 * Purpose:
 *   Friendship Aggregate Root in the Messaging domain. Manages the friend request state machine.
 *
 * 调用方 / Called by:
 *   - PrismaFriendshipRepository
 *   - MessagingApplicationService
 *
 * 中文关键词：
 *   好友关系，聚合根，状态机，请求
 * English keywords:
 *   friendship, aggregate root, state machine, request
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
   * 函数名称：accept
   *
   * 函数作用：
   *   接受好友请求。仅收件人可以操作，且状态必须为 PENDING。
   * Purpose:
   *   Accepts a pending friend request. Only the addressee can perform this action.
   *
   * 调用方 / Called by:
   *   MessagingApplicationService.respondFriendRequest
   *
   * 参数说明 / Parameters:
   *   - userId: string, 收件人用户 ID
   *
   * 错误处理 / Error handling:
   *   - ERR_FORBIDDEN_NOT_ADDRESSEE（非收件人）
   *   - ERR_FRIENDSHIP_NOT_PENDING（非待处理状态）
   *
   * 中文关键词：
   接受好友，请求
   * English keywords:
   *   accept friend, request
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
   * 函数名称：reject
   *
   * 函数作用：
   *   拒绝好友请求。仅收件人可以操作，且状态必须为 PENDING。
   * Purpose:
   *   Rejects a pending friend request. Only the addressee can perform this action.
   *
   * 调用方 / Called by:
   *   MessagingApplicationService.respondFriendRequest
   *
   * 参数说明 / Parameters:
   *   - userId: string, 收件人用户 ID
   *
   * 错误处理 / Error handling:
   *   - ERR_FORBIDDEN_NOT_ADDRESSEE
   *   - ERR_FRIENDSHIP_NOT_PENDING
   *
   * 中文关键词：
   拒绝好友，请求
   * English keywords:
   *   reject friend, request
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
   * 函数名称：block
   *
   * 函数作用：
   *   拉黑对方用户。操作后状态变为 BLOCKED，拉黑者设为 requester。
   * Purpose:
   *   Blocks the other user. Status changes to BLOCKED, blocker becomes the requester.
   *
   * 调用方 / Called by:
   *   MessagingApplicationService.blockUser
   *
   * 参数说明 / Parameters:
   *   - blockerId: string, 执行拉黑的用户 ID
   *
   * 错误处理 / Error handling:
   *   - ERR_FORBIDDEN_NOT_INVOLVED（非好友关系参与者）
   *
   * 中文关键词：
   拉黑用户，屏蔽
   * English keywords:
   *   block user, blacklist
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