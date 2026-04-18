/**
 * Represents a Unit of Work, ensuring that a set of operations
 * either all succeed or all fail together.
 */
export interface IUnitOfWork {
  /**
   * Executes the given work block within a transaction context.
   * If the block throws an error, the transaction is rolled back.
   * If it completes successfully, the transaction is committed.
   * 
   * @param work The function to execute within the transaction.
   * @returns The result of the work function.
   */
  execute<T>(work: () => Promise<T>): Promise<T>;
}
