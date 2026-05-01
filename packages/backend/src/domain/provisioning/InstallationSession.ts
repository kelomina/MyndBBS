export interface InstallationSessionProps {
  id: string;
  createdAt: Date;
  isCompleted: boolean;
}

/**
 * 类名称：InstallationSession
 *
 * 函数作用：
 *   安装流程中的会话实体，追踪安装进度。
 * Purpose:
 *   Installation session entity that tracks the setup progress.
 *
 * 调用方 / Called by:
 *   - InstallationApplicationService
 *   - InMemoryInstallationSessionRepository
 *
 * 中文关键词：
 *   安装会话，实体，安装流程
 * English keywords:
 *   installation session, entity, setup flow
 */
export class InstallationSession {
  private props: InstallationSessionProps;

  /**
   * 函数名称：constructor（私有）
   *
   * 函数作用：
   *   私有构造函数，强制通过静态工厂方法实例化。
   * Purpose:
   *   Private constructor to enforce instantiation via static factory methods.
   */
  private constructor(props: InstallationSessionProps) {
    this.props = { ...props };
  }

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新的安装会话。
   * Purpose:
   *   Static factory method — creates a new installation session.
   *
   * 调用方 / Called by:
   *   InMemoryInstallationSessionRepository
   *
   * 参数说明 / Parameters:
   *   - props: InstallationSessionProps（id 必填）
   *
   * 错误处理 / Error handling:
   *   - ERR_INSTALLATION_SESSION_MISSING_ID
   *
   * 中文关键词：
   创建安装会话
   * English keywords:
   *   create installation session
   */
  public static create(props: InstallationSessionProps): InstallationSession {
    if (!props.id) {
      throw new Error('ERR_INSTALLATION_SESSION_MISSING_ID');
    }
    return new InstallationSession(props);
  }

  /**
   * 函数名称：load
   *
   * 函数作用：
   *   从持久化状态重建安装会话实体。
   * Purpose:
   *   Reconstitutes an InstallationSession from persistence.
   *
   * 中文关键词：
   加载安装会话
   * English keywords:
   *   load installation session
   */
  public static load(props: InstallationSessionProps): InstallationSession {
    return new InstallationSession(props);
  }

  public get id(): string { return this.props.id; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get isCompleted(): boolean { return this.props.isCompleted; }

  /**
   * 函数名称：markCompleted
   *
   * 函数作用：
   *   将会话标记为已完成。
   * Purpose:
   *   Marks the installation session as completed.
   *
   * 错误处理 / Error handling:
   *   - ERR_INSTALLATION_SESSION_ALREADY_COMPLETED
   *
   * 中文关键词：
   标记完成，安装会话
   * English keywords:
   *   mark completed, installation session
   */
  public markCompleted(): void {
    if (this.props.isCompleted) {
      throw new Error('ERR_INSTALLATION_SESSION_ALREADY_COMPLETED');
    }
    this.props.isCompleted = true;
  }
}
