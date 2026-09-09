import { ReviewRecommendation } from './Review'

export class EditorialPolicy {
  public static readonly MINIMUM_VALID_REVIEWS = 3

  public static assertEnoughReviews(submittedReviewCount: number): void {
    if (submittedReviewCount < EditorialPolicy.MINIMUM_VALID_REVIEWS) {
      throw new Error('ERR_MINIMUM_REVIEW_COUNT_NOT_MET')
    }
  }

  public static assertReviewerEligible(reviewerId: string, authorIds: readonly string[], conflictDeclared: boolean): void {
    if (authorIds.includes(reviewerId)) throw new Error('ERR_AUTHOR_CANNOT_REVIEW_OWN_SUBMISSION')
    if (conflictDeclared) throw new Error('ERR_REVIEWER_CONFLICT_DECLARED')
  }

  public static summarize(recommendations: readonly ReviewRecommendation[]): ReviewRecommendation {
    this.assertEnoughReviews(recommendations.length)
    const counts = new Map<ReviewRecommendation, number>()
    for (const recommendation of recommendations) counts.set(recommendation, (counts.get(recommendation) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  }
}
