import { createHash, randomUUID } from 'crypto'
import { assertSubmissionPdf } from '../../domain/journal/PdfSubmissionPolicy'

export interface PrivateSubmissionStorage {
  put(key: string, content: Buffer, contentType: string): Promise<void>
  remove(key: string): Promise<void>
}

export interface SubmissionFileRecord { id: string; versionId: string; storageKey: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string }

export interface SubmissionFileRepository {
  save(file: SubmissionFileRecord): Promise<void>
}

export class SubmissionFileApplicationService {
  constructor(private readonly storage: PrivateSubmissionStorage, private readonly repository: SubmissionFileRepository) {}

  public async uploadPdf(input: { journalId: string; submissionId: string; versionId: string; originalName: string; mimeType: string; content: Buffer }): Promise<SubmissionFileRecord> {
    assertSubmissionPdf({ originalName: input.originalName, mimeType: input.mimeType, sizeBytes: input.content.byteLength, header: input.content.subarray(0, 5) })
    const id = randomUUID()
    const storageKey = `journals/${input.journalId}/submissions/${input.submissionId}/versions/${input.versionId}/${id}.pdf`
    const file: SubmissionFileRecord = { id, versionId: input.versionId, storageKey, originalName: input.originalName, mimeType: 'application/pdf', sizeBytes: input.content.byteLength, sha256: createHash('sha256').update(input.content).digest('hex') }
    await this.storage.put(storageKey, input.content, 'application/pdf')
    try { await this.repository.save(file) } catch (error) { await this.storage.remove(storageKey); throw error }
    return file
  }

  public async uploadPdfForAuthor(input: { userId: string; canUpload: (versionId: string, userId: string) => Promise<boolean> } & Omit<Parameters<SubmissionFileApplicationService['uploadPdf']>[0], never>): Promise<SubmissionFileRecord> {
    if (!(await input.canUpload(input.versionId, input.userId))) throw new Error('ERR_FORBIDDEN_SUBMISSION_FILE_UPLOAD')
    return this.uploadPdf(input)
  }
}
