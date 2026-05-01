/**
 * 类名称：PrismaDatabaseSchemaApplier
 *
 * 函数作用：
 *   使用 Prisma db push 执行数据库 Schema 同步。
 * Purpose:
 *   Applies database schema changes using Prisma db push.
 *
 * 中文关键词：
 *   数据库，Schema，Prisma，安装
 * English keywords:
 *   database, schema, Prisma, setup
 */
import { execFile } from 'child_process';
import path from 'path';
import { IDatabaseSchemaApplier } from '../../../domain/provisioning/IDatabaseSchemaApplier';

export class PrismaDatabaseSchemaApplier implements IDatabaseSchemaApplier {
  async applySchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile('npx', ['prisma', 'db', 'push'], { cwd: path.resolve(__dirname, '../../../../') }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve();
      });
    });
  }
}
