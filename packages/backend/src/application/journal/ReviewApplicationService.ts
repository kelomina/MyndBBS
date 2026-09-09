import { randomUUID } from 'crypto'
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork'
import { IJournalRepository } from '../../domain/journal/IJournalRepository'
import { EditorialPolicy } from '../../domain/journal/EditorialPolicy'
import { Review, ReviewProps } from '../../domain/journal/Review'
import { ReviewAssignment } from '../../domain/journal/ReviewAssignment'
import { Submission } from '../../domain/journal/Submission'

export interface ReviewPersistencePort {
  countAssignmentsForVersion(versionId: string): Promise<number>
  saveAssignment(assignment: ReviewAssignment): Promise<void>
  findAssignment(id: string): Promise<ReviewAssignment | null>
  saveReview(review: Review): Promise<void>
}

export class ReviewApplicationService {
  constructor(private readonly journal: IJournalRepository, private readonly reviews: ReviewPersistencePort, private readonly unitOfWork: IUnitOfWork) {}

  public async assignReviewer(input: { submissionId: string; versionId: string; reviewerId: string; editorId: string; authorIds: string[]; dueAt: Date }): Promise<ReviewAssignment> {
    return this.unitOfWork.execute(async () => {
      const submission = await this.journal.findSubmissionById(input.submissionId)
      if (!submission || submission.status === 'WITHDRAWN') throw new Error('ERR_SUBMISSION_NOT_FOUND')
      if (!(await this.journal.isEditor(submission.journalId, input.editorId))) throw new Error('ERR_FORBIDDEN_JOURNAL_EDITOR_ONLY')
      if (!(await this.journal.versionBelongsToSubmission(input.versionId, input.submissionId))) throw new Error('ERR_VERSION_NOT_IN_SUBMISSION')
      if (!['EDITORIAL_SCREENING', 'UNDER_REVIEW'].includes(submission.status)) throw new Error('ERR_INVALID_SUBMISSION_STATE')
      EditorialPolicy.assertReviewerEligible(input.reviewerId, await this.journal.getSubmissionAuthorIds(input.submissionId), false)
      const assignment = ReviewAssignment.create({ id: randomUUID(), submissionId: input.submissionId, versionId: input.versionId, reviewerId: input.reviewerId, assignedById: input.editorId, dueAt: input.dueAt })
      await this.reviews.saveAssignment(assignment)
      return assignment
    })
  }

  public async submitReview(input: ReviewProps): Promise<Review> {
    return this.unitOfWork.execute(async () => {
      const assignment = await this.reviews.findAssignment(input.assignmentId)
      if (!assignment || assignment.reviewerId !== input.reviewerId) throw new Error('ERR_FORBIDDEN_REVIEW_ASSIGNMENT')
      if (input.versionId !== assignment.versionId) throw new Error('ERR_VERSION_NOT_IN_ASSIGNMENT')
      if (assignment.currentStatus === 'INVITED') assignment.accept()
      if (assignment.currentStatus === 'ACCEPTED') assignment.start()
      const review = Review.submit(input)
      assignment.submit()
      await this.reviews.saveReview(review)
      await this.reviews.saveAssignment(assignment)
      return review
    })
  }

  public async assertDecisionEligible(versionId: string): Promise<void> {
    EditorialPolicy.assertEnoughReviews(await this.journal.countSubmittedReviews(versionId))
  }
}

export type { Submission }
