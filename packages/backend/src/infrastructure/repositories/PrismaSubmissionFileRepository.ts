import { prisma } from '../../db'
import { SubmissionFileRecord, SubmissionFileRepository } from '../../application/journal/SubmissionFileApplicationService'

export class PrismaSubmissionFileRepository implements SubmissionFileRepository {
  public async save(file: SubmissionFileRecord): Promise<void> {
    await prisma.submissionFile.create({ data: { id: file.id, versionId: file.versionId, storageKey: file.storageKey, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, sha256: file.sha256, scanStatus: 'CLEAN' } })
  }
  public async getAuthorizedFile(id: string, userId: string): Promise<{ storageKey: string; originalName: string } | null> {
    const row = await prisma.submissionFile.findFirst({ where: { id, OR: [
      { version: { submission: { submittingAuthorId: userId } } },
      { version: { submission: { journal: { members: { some: { userId, active: true, role: { in: ['OWNER', 'EDITOR'] } } } } } } },
      { version: { assignments: { some: { reviewerId: userId, status: { in: ['INVITED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED'] } } } } },
    ] }, select: { storageKey: true, originalName: true } })
    if (!row) return null
    return { storageKey: row.storageKey, originalName: row.originalName }
  }
}
