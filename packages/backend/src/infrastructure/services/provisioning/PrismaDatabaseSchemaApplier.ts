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
