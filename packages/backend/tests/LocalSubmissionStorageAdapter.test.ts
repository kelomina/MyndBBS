import { LocalSubmissionStorageAdapter } from '../src/infrastructure/services/system/LocalSubmissionStorageAdapter'
import fs from 'fs/promises'
import path from 'path'

describe('LocalSubmissionStorageAdapter', () => {
  const root = path.join(process.cwd(), '.tmp-submission-storage-test')
  beforeEach(async () => { process.env.SUBMISSION_UPLOAD_DIR = root; await fs.rm(root, { recursive: true, force: true }) })
  afterAll(async () => { await fs.rm(root, { recursive: true, force: true }); delete process.env.SUBMISSION_UPLOAD_DIR })
  it('writes and reads private files', async () => {
    const storage = new LocalSubmissionStorageAdapter()
    await storage.put('j/s/v/file.pdf', Buffer.from('pdf'))
    await expect(storage.read('j/s/v/file.pdf')).resolves.toEqual(Buffer.from('pdf'))
    await storage.remove('j/s/v/file.pdf')
    await expect(storage.read('j/s/v/file.pdf')).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('blocks path traversal', async () => { await expect(new LocalSubmissionStorageAdapter().put('../escape.pdf', Buffer.from('x'))).rejects.toThrow('ERR_INVALID_SUBMISSION_STORAGE_KEY') })
})
