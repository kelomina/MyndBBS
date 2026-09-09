import { prisma } from '../../db'
import { IJournalRepository } from '../../domain/journal/IJournalRepository'
import { Submission, SubmissionStatus } from '../../domain/journal/Submission'
import { SubmissionVersion } from '../../domain/journal/SubmissionVersion'

/** Prisma persistence adapter for journal submissions and immutable versions. */
export class PrismaJournalRepository implements IJournalRepository {
  public async journalExists(id: string): Promise<boolean> {
    return (await prisma.journal.count({ where: { id, status: { in: ['ACTIVE', 'DRAFT'] } } })) > 0
  }
  public async isEditor(journalId: string, userId: string): Promise<boolean> {
    const member = await prisma.journalMember.findUnique({ where: { journalId_userId: { journalId, userId } } })
    return !!member?.active && (member.role === 'OWNER' || member.role === 'EDITOR')
  }
  public async getSubmissionAuthorIds(submissionId: string): Promise<string[]> {
    const submission = await prisma.submission.findUnique({ where: { id: submissionId }, select: { submittingAuthorId: true, authors: { select: { userId: true } } } })
    if (!submission) return []
    return [...new Set([submission.submittingAuthorId, ...submission.authors.map((row) => row.userId)])]
  }
  public async canAuthorUploadVersion(versionId: string, userId: string): Promise<boolean> {
    const version = await prisma.submissionVersion.findUnique({ where: { id: versionId }, select: { submission: { select: { submittingAuthorId: true, status: true } } } })
    return !!version && version.submission.submittingAuthorId === userId && ['DRAFT', 'REVISION_REQUIRED'].includes(version.submission.status)
  }
  public async versionBelongsToSubmission(versionId: string, submissionId: string): Promise<boolean> {
    const version = await prisma.submissionVersion.findUnique({ where: { id: versionId }, select: { submissionId: true } })
    return version?.submissionId === submissionId
  }
  public async findSubmissionById(id: string): Promise<Submission | null> {
    const row = await prisma.submission.findUnique({ where: { id } })
    if (!row) return null
    return Submission.load({
      id: row.id,
      journalId: row.journalId,
      submittingAuthorId: row.submittingAuthorId,
      title: row.title,
      abstract: row.abstract,
      status: row.status as unknown as SubmissionStatus,
      currentVersionId: row.currentVersionId,
      reviewRound: row.reviewRound,
      submittedAt: row.submittedAt,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  public async saveSubmission(submission: Submission): Promise<void> {
    await prisma.submission.upsert({
      where: { id: submission.id },
      create: {
        id: submission.id,
        journalId: submission.journalId,
        submittingAuthorId: submission.submittingAuthorId,
        title: submission.title,
        abstract: submission.abstract,
        status: submission.status as any,
        currentVersionId: submission.currentVersionId,
        reviewRound: submission.reviewRound,
        submittedAt: submission.submittedAt,
        decidedAt: submission.decidedAt,
        createdAt: submission.createdAt,
      },
      update: {
        title: submission.title,
        abstract: submission.abstract,
        status: submission.status as any,
        currentVersionId: submission.currentVersionId,
        reviewRound: submission.reviewRound,
        submittedAt: submission.submittedAt,
        decidedAt: submission.decidedAt,
      },
    })
  }

  public async saveVersion(version: SubmissionVersion): Promise<void> {
    await prisma.submissionVersion.create({
      data: {
        id: version.id,
        submissionId: version.submissionId,
        versionNumber: version.versionNumber,
        title: version.title,
        abstract: version.abstract,
        createdById: version.createdById,
        createdAt: version.createdAt,
      },
    })
  }

  public async countSubmittedReviews(versionId: string): Promise<number> {
    return prisma.review.count({ where: { versionId, submittedAt: { not: null } } })
  }
}
