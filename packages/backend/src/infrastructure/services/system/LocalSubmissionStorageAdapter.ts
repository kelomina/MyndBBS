import path from 'path'
import fs from 'fs/promises'
import { PrivateSubmissionStorage } from '../../../application/journal/SubmissionFileApplicationService'

/** Private filesystem storage for manuscript PDFs; never exposed by /uploads static serving. */
export class LocalSubmissionStorageAdapter implements PrivateSubmissionStorage {
  private root(): string { return path.resolve(process.env.SUBMISSION_UPLOAD_DIR || path.join(process.cwd(), 'private-submissions')) }
  private resolveKey(key: string): string {
    const root = this.root()
    const full = path.resolve(root, key)
    if (!full.startsWith(root + path.sep)) throw new Error('ERR_INVALID_SUBMISSION_STORAGE_KEY')
    return full
  }
  public async put(key: string, content: Buffer): Promise<void> {
    const full = this.resolveKey(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, content, { flag: 'wx' })
  }
  public async remove(key: string): Promise<void> {
    try { await fs.unlink(this.resolveKey(key)) } catch (error: any) { if (error.code !== 'ENOENT') throw error }
  }
  public async read(key: string): Promise<Buffer> { return fs.readFile(this.resolveKey(key)) }
}
