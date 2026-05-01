/**
 * 接口名称：IDatabaseSchemaApplier
 *
 * 函数作用：
 *   数据库 Schema 应用器接口——用于在安装流程中执行 Schema 同步。
 * Purpose:
 *   Database schema applier interface — used to apply schema changes during installation.
 *
 * 中文关键词：
 *   数据库，Schema，安装接口
 * English keywords:
 *   database, schema, setup interface
 */
export interface IDatabaseSchemaApplier {
  applySchema(): Promise<void>;
}
