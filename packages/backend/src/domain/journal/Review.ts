export enum ReviewRecommendation { ACCEPT='ACCEPT', MINOR_REVISION='MINOR_REVISION', MAJOR_REVISION='MAJOR_REVISION', REJECT='REJECT' }

export interface ReviewProps {
  id: string; assignmentId: string; versionId: string; reviewerId: string
  recommendation: ReviewRecommendation; publicComments: string; confidentialComments?: string | null; submittedAt: Date
}

export class Review {
  private constructor(
    public readonly id: string,
    public readonly assignmentId: string,
    public readonly versionId: string,
    public readonly reviewerId: string,
    public readonly recommendation: ReviewRecommendation,
    public readonly publicComments: string,
    public readonly confidentialComments: string | null,
    public readonly submittedAt: Date,
  ) {}

  public static submit(props: ReviewProps): Review {
    if (!props.publicComments.trim()) throw new Error('ERR_REVIEW_COMMENTS_REQUIRED')
    return new Review(props.id, props.assignmentId, props.versionId, props.reviewerId, props.recommendation, props.publicComments.trim(), props.confidentialComments?.trim() || null, props.submittedAt)
  }
}
