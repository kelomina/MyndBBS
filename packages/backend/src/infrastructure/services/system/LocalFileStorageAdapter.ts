import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { IStoragePort } from '../../../domain/system/ports/IStoragePort';

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

  private getAvatarsDir(): string {
    return path.join(this.getUploadRootDir(), 'avatars');
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

  public async saveAvatar(userId: string, content: Buffer, ext: string): Promise<string> {
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '');
    if (!safeExt) {
      throw new Error('ERR_INVALID_FILE_EXTENSION');
    }

    const avatarsDir = this.getAvatarsDir();
    await fs.mkdir(avatarsDir, { recursive: true });

    const filename = `${userId}-${randomUUID()}.${safeExt}`;
    const filePath = path.join(avatarsDir, filename);
    await fs.writeFile(filePath, content);

    return `/uploads/avatars/${filename}`;
  }

  public async deleteAvatar(filePath: string): Promise<void> {
    const avatarPathPattern = /^\/uploads\/avatars\/[a-zA-Z0-9-]+\.[a-z]{3,4}$/;
    if (!avatarPathPattern.test(filePath)) {
      throw new Error('ERR_INVALID_AVATAR_PATH');
    }

    const relativePath = filePath.replace(/^\/uploads\//, '');
    const uploadRoot = path.resolve(this.getUploadRootDir());
    const fullPath = path.resolve(uploadRoot, relativePath);

    if (!fullPath.startsWith(uploadRoot + path.sep)) {
      throw new Error('ERR_INVALID_PATH');
    }

    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
