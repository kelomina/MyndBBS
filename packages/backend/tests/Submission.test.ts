import { Submission, SubmissionStatus } from '../src/domain/journal/Submission'
import { EditorialPolicy } from '../src/domain/journal/EditorialPolicy'
import { ReviewRecommendation } from '../src/domain/journal/Review'

describe('Journal Submission', () => {
  const base = { id: 's1', journalId: 'j1', submittingAuthorId: 'u1', title: 'A paper', abstract: null, createdAt: new Date('2025-01-01') }

  it('requires an explicit valid lifecycle', () => {
    const s = Submission.create(base)
    expect(s.status).toBe(SubmissionStatus.DRAFT)
    s.submit()
    s.beginTechnicalCheck()
    s.beginEditorialScreening()
    s.sendToReview()
    s.requestRevision()
    s.resubmit()
    expect(s.reviewRound).toBe(1)
    expect(() => s.accept()).toThrow('ERR_INVALID_SUBMISSION_STATE_TRANSITION')
  })

  it('rejects illegal transitions and empty titles', () => {
    expect(() => Submission.create({ ...base, title: ' ' })).toThrow('ERR_SUBMISSION_TITLE_REQUIRED')
    const s = Submission.create(base)
    expect(() => s.sendToReview()).toThrow('ERR_INVALID_SUBMISSION_STATE_TRANSITION')
  })
})

describe('EditorialPolicy', () => {
  it('requires three submitted reviews and summarizes recommendations', () => {
    expect(() => EditorialPolicy.assertEnoughReviews(2)).toThrow('ERR_MINIMUM_REVIEW_COUNT_NOT_MET')
    expect(EditorialPolicy.summarize([
      ReviewRecommendation.ACCEPT,
      ReviewRecommendation.ACCEPT,
      ReviewRecommendation.MINOR_REVISION,
    ])).toBe(ReviewRecommendation.ACCEPT)
  })
})
