/**
 * 接口名称：IDatabaseConnectionValidator
 *
 * 函数作用：
 *   数据库连接验证器接口——用于在安装流程中验证数据库 URL 是否可用。
 * Purpose:
 *   Database connection validator interface — used to verify database URL connectivity during installation.
 *
 * 中文关键词：
 *   数据库，连接验证，安装接口
 * English keywords:
 *   database, connection validation, setup interface
 */
export interface IDatabaseConnectionValidator {
  validate(dbUrl: string): Promise<boolean>;
}
