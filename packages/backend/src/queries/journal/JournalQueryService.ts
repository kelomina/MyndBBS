import { prisma } from '../../db'

export class JournalQueryService {
  public async listPublic() {
    return prisma.journal.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, slug: true, name: true, description: true } })
  }

  public async getPublicBySlug(slug: string) {
    return prisma.journal.findFirst({ where: { slug, status: 'ACTIVE' }, select: { id: true, slug: true, name: true, description: true, createdAt: true } })
  }

  public async getForAuthor(journalId: string, authorId: string) {
    return prisma.submission.findMany({ where: { journalId, submittingAuthorId: authorId }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, abstract: true, status: true, reviewRound: true, submittedAt: true, decidedAt: true, createdAt: true, updatedAt: true } })
  }

  public async getForEditor(journalId: string, editorId: string) {
    const member = await prisma.journalMember.findUnique({ where: { journalId_userId: { journalId, userId: editorId } } })
    if (!member || !member.active || !['OWNER', 'EDITOR'].includes(member.role)) throw new Error('ERR_FORBIDDEN_JOURNAL_EDITOR_ONLY')
    return prisma.submission.findMany({ where: { journalId, status: { notIn: ['DRAFT', 'WITHDRAWN'] } }, orderBy: { updatedAt: 'asc' }, select: { id: true, title: true, abstract: true, status: true, reviewRound: true, submittedAt: true, decidedAt: true, createdAt: true, updatedAt: true } })
  }

  public async getReviewerAssignments(reviewerId: string) {
    return prisma.reviewerAssignment.findMany({ where: { reviewerId }, orderBy: { dueAt: 'asc' }, select: { id: true, versionId: true, status: true, dueAt: true, invitedAt: true } })
  }

  public async getSubmissionForAuthor(id: string, authorId: string) {
    return prisma.submission.findFirst({ where: { id, submittingAuthorId: authorId }, select: { id: true, title: true, abstract: true, status: true, reviewRound: true, currentVersionId: true, submittedAt: true, decidedAt: true, versions: { orderBy: { versionNumber: 'desc' }, select: { id: true, versionNumber: true, title: true, createdAt: true, files: { select: { id: true, originalName: true, sizeBytes: true, scanStatus: true, createdAt: true } } } }, decisions: { orderBy: { createdAt: 'desc' }, select: { decision: true, reason: true, round: true, createdAt: true } } } })
  }

  public async getAssignmentForReviewer(id: string, reviewerId: string) {
    return prisma.reviewerAssignment.findFirst({ where: { id, reviewerId }, select: { id: true, versionId: true, status: true, dueAt: true, version: { select: { id: true, title: true, abstract: true, files: { select: { id: true, originalName: true, sizeBytes: true, scanStatus: true } } } } } })
  }
}

export const journalQueryService = new JournalQueryService()
