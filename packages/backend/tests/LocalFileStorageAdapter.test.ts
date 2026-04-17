import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { LocalFileStorageAdapter } from '../src/infrastructure/services/system/LocalFileStorageAdapter';

describe('LocalFileStorageAdapter', () => {
  const originalUploadDir = process.env.UPLOAD_DIR;

  afterEach(() => {
    process.env.UPLOAD_DIR = originalUploadDir;
  });

  it('should save file under messages directory and return public url', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'myndbbs-uploads-'));
    process.env.UPLOAD_DIR = tmpRoot;

    try {
      const adapter = new LocalFileStorageAdapter();
      const url = await adapter.saveFile('test.enc', Buffer.from('hello'));

      expect(url).toBe('/uploads/messages/test.enc');
      const stored = await fs.readFile(path.join(tmpRoot, 'messages', 'test.enc'), 'utf8');
      expect(stored).toBe('hello');
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('should reject unsafe filenames', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'myndbbs-uploads-'));
    process.env.UPLOAD_DIR = tmpRoot;

    try {
      const adapter = new LocalFileStorageAdapter();
      await expect(adapter.saveFile('../evil.enc', Buffer.from('x'))).rejects.toThrow('ERR_INVALID_FILENAME');
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

