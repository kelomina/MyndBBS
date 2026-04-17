import path from 'path';
import fs from 'fs/promises';
import { IStoragePort } from '../../../domain/system/ports/IStoragePort';

/**
 * Callers: [Registry]
 * Callees: [fs, path]
 * Description: Stores uploaded files on the local filesystem under the configured upload directory.
 * Keywords: storage, adapter, infrastructure, local, filesystem, upload
 */
export class LocalFileStorageAdapter implements IStoragePort {
  private getUploadRootDir(): string {
    const configured = process.env.UPLOAD_DIR;
    if (configured && configured.trim()) {
      return path.resolve(process.cwd(), configured.trim());
    }
    return path.join(process.cwd(), 'uploads');
  }

  private getMessagesDir(): string {
    return path.join(this.getUploadRootDir(), 'messages');
  }

  public async saveFile(filename: string, content: Buffer): Promise<string> {
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename) {
      throw new Error('ERR_INVALID_FILENAME');
    }

    const messagesDir = this.getMessagesDir();
    await fs.mkdir(messagesDir, { recursive: true });

    const filePath = path.join(messagesDir, safeName);
    await fs.writeFile(filePath, content);

    return `/uploads/messages/${safeName}`;
  }
}

