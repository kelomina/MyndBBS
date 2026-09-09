import { prisma } from '../../db'
import { ReviewPersistencePort } from '../../application/journal/ReviewApplicationService'
import { Review, ReviewRecommendation } from '../../domain/journal/Review'
import { ReviewAssignment, ReviewAssignmentStatus } from '../../domain/journal/ReviewAssignment'

/** Persistence adapter for blinded review assignments and review reports. */
export class PrismaReviewRepository implements ReviewPersistencePort {
  public async countAssignmentsForVersion(versionId: string): Promise<number> {
    return prisma.reviewerAssignment.count({ where: { versionId } })
  }

  public async saveAssignment(assignment: ReviewAssignment): Promise<void> {
    await prisma.reviewerAssignment.upsert({
      where: { id: assignment.id },
      create: {
        id: assignment.id,
        submissionId: assignment.submissionId,
        versionId: assignment.versionId,
        reviewerId: assignment.reviewerId,
        assignedById: assignment.assignedById,
        status: assignment.currentStatus as any,
        dueAt: assignment.dueAt,
      },
      update: { status: assignment.currentStatus as any, respondedAt: new Date() },
    })
  }

  public async findAssignment(id: string): Promise<ReviewAssignment | null> {
    const row = await prisma.reviewerAssignment.findUnique({ where: { id } })
    if (!row) return null
    return ReviewAssignment.load({ id: row.id, submissionId: row.submissionId, versionId: row.versionId, reviewerId: row.reviewerId, assignedById: row.assignedById, status: row.status as unknown as ReviewAssignmentStatus, dueAt: row.dueAt })
  }

  public async saveReview(review: Review): Promise<void> {
    await prisma.review.create({
      data: {
        id: review.id,
        assignmentId: review.assignmentId,
        versionId: review.versionId,
        reviewerId: review.reviewerId,
        recommendation: review.recommendation as any,
        publicComments: review.publicComments,
        confidentialComments: review.confidentialComments,
        submittedAt: review.submittedAt,
      },
    })
  }
}
