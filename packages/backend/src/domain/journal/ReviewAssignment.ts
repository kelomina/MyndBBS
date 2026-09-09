export enum ReviewAssignmentStatus { INVITED='INVITED', ACCEPTED='ACCEPTED', DECLINED='DECLINED', CONFLICT_DECLARED='CONFLICT_DECLARED', IN_PROGRESS='IN_PROGRESS', SUBMITTED='SUBMITTED', EXPIRED='EXPIRED', CANCELLED='CANCELLED' }

export class ReviewAssignment {
  private constructor(
    public readonly id: string,
    public readonly submissionId: string,
    public readonly versionId: string,
    public readonly reviewerId: string,
    public readonly assignedById: string,
    private status: ReviewAssignmentStatus,
    public readonly dueAt: Date,
  ) {}

  public static create(props: { id: string; submissionId: string; versionId: string; reviewerId: string; assignedById: string; dueAt: Date }): ReviewAssignment {
    if (props.reviewerId === props.assignedById) throw new Error('ERR_REVIEWER_CANNOT_ASSIGN_SELF')
    if (props.dueAt.getTime() <= Date.now()) throw new Error('ERR_REVIEW_DUE_DATE_MUST_BE_FUTURE')
    return new ReviewAssignment(props.id, props.submissionId, props.versionId, props.reviewerId, props.assignedById, ReviewAssignmentStatus.INVITED, props.dueAt)
  }

  public static load(props: { id: string; submissionId: string; versionId: string; reviewerId: string; assignedById: string; status: ReviewAssignmentStatus; dueAt: Date }): ReviewAssignment {
    return new ReviewAssignment(props.id, props.submissionId, props.versionId, props.reviewerId, props.assignedById, props.status, props.dueAt)
  }
  public get currentStatus(): ReviewAssignmentStatus { return this.status }
  public accept(): void { this.transition(ReviewAssignmentStatus.ACCEPTED, [ReviewAssignmentStatus.INVITED]) }
  public decline(): void { this.transition(ReviewAssignmentStatus.DECLINED, [ReviewAssignmentStatus.INVITED]) }
  public declareConflict(): void { this.transition(ReviewAssignmentStatus.CONFLICT_DECLARED, [ReviewAssignmentStatus.INVITED, ReviewAssignmentStatus.ACCEPTED]) }
  public start(): void { this.transition(ReviewAssignmentStatus.IN_PROGRESS, [ReviewAssignmentStatus.ACCEPTED]) }
  public submit(): void { this.transition(ReviewAssignmentStatus.SUBMITTED, [ReviewAssignmentStatus.IN_PROGRESS]) }
  public cancel(): void { this.transition(ReviewAssignmentStatus.CANCELLED, [ReviewAssignmentStatus.INVITED, ReviewAssignmentStatus.ACCEPTED]) }
  private transition(next: ReviewAssignmentStatus, allowed: ReviewAssignmentStatus[]): void {
    if (!allowed.includes(this.status)) throw new Error('ERR_INVALID_REVIEW_ASSIGNMENT_TRANSITION')
    this.status = next
  }
}
