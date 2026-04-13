export interface ConversationSettingProps {
  userId: string;
  partnerId: string;
  allowTwoSidedDelete: boolean;
}

/**
 * Callers: [PrismaConversationSettingRepository, MessagingApplicationService]
 * Callees: []
 * Description: Represents the ConversationSetting Aggregate Root within the Messaging domain. Manages user preferences for a specific conversation.
 * Keywords: conversationsetting, aggregate, root, domain, entity, messaging, preferences, delete
 */
export class ConversationSetting {
  private props: ConversationSettingProps;

  /**
   * Callers: [ConversationSetting.create, PrismaConversationSettingRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, conversationsetting, entity, instantiation
   */
  private constructor(props: ConversationSettingProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaConversationSettingRepository, MessagingApplicationService.updateConversationSettings]
   * Callees: [ConversationSetting.constructor]
   * Description: Static factory method creating a new ConversationSetting entity. Validates essential fields.
   * Keywords: create, factory, conversationsetting, domain, instantiation
   */
  public static create(props: ConversationSettingProps): ConversationSetting {
    if (!props.userId || !props.partnerId) {
      throw new Error('ERR_CONVERSATION_SETTING_MISSING_USERS');
    }
    return new ConversationSetting(props);
  }

  /**
   * Callers: [PrismaConversationSettingRepository]
   * Callees: [ConversationSetting.constructor]
   * Description: Static factory method reconstituting a ConversationSetting entity from database state.
   * Keywords: load, factory, conversationsetting, domain, reconstitute
   */
  public static load(props: ConversationSettingProps): ConversationSetting {
    return new ConversationSetting(props);
  }

  // --- Accessors ---

  public get userId(): string { return this.props.userId; }
  public get partnerId(): string { return this.props.partnerId; }
  public get allowTwoSidedDelete(): boolean { return this.props.allowTwoSidedDelete; }

  // --- Domain Behaviors ---

  /**
   * Callers: [MessagingApplicationService.updateConversationSettings]
   * Callees: []
   * Description: Updates the user's preference for allowing two-sided hard deletes by the partner.
   * Keywords: update, preference, conversationsetting, delete, hard
   */
  public updatePreference(allow: boolean): void {
    this.props.allowTwoSidedDelete = allow;
  }
}