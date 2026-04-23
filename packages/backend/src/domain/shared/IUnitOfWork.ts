/**
 * Callers: [Application Services, AuditApplicationService, PrismaUnitOfWork]
 * Callees: []
 * Description: Defines the Unit of Work contract that wraps application-layer write operations in a transaction.
 * 描述：定义工作单元契约，用于把应用层写操作包装进同一个事务边界。
 * Variables: `work` 表示需要在事务内执行的异步工作单元；`T` 表示工作单元返回值类型。
 * 变量：`work` 表示事务内执行的异步逻辑；`T` 表示该逻辑的返回值类型。
 * Integration: Inject an `IUnitOfWork` implementation into application services that coordinate repository writes.
 * 接入方式：将 `IUnitOfWork` 的实现注入需要协调仓储写入的应用服务。
 * Error Handling: Implementations must roll back the transaction when `work` throws and must surface the original error.
 * 错误处理：当 `work` 抛错时，实现类必须回滚事务并向上抛出原始异常。
 * Keywords: unit of work, transaction, commit, rollback, application service, 工作单元, 事务, 提交, 回滚, 应用服务
 */
export interface IUnitOfWork {
  /**
   * Callers: [Application Services, AuditApplicationService]
   * Callees: []
   * Description: Executes the supplied async work within one transactional boundary and returns its result.
   * 描述：在单个事务边界内执行传入的异步工作并返回结果。
   * Variables: `work` 是事务内执行的回调；`T` 是返回值类型。
   * 变量：`work` 是事务回调；`T` 是返回结果的类型。
   * Integration: Pass a repository orchestration callback that performs every required write for one use case.
   * 接入方式：传入一个会完成单个用例所需全部写操作的仓储编排回调。
   * Error Handling: Throwing inside `work` must abort the transaction; successful completion must commit it.
   * 错误处理：`work` 内抛错必须终止并回滚事务；正常完成则提交事务。
   * Keywords: execute, transaction, callback, commit, rollback, 执行, 事务, 回调, 提交, 回滚
   */
  execute<T>(work: () => Promise<T>): Promise<T>;
}
