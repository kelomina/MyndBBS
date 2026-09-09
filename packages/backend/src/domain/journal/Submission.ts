export enum SubmissionStatus {
  DRAFT = 'DRAFT', SUBMITTED = 'SUBMITTED', TECHNICAL_CHECK = 'TECHNICAL_CHECK',
  EDITORIAL_SCREENING = 'EDITORIAL_SCREENING', UNDER_REVIEW = 'UNDER_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED', RESUBMITTED = 'RESUBMITTED', ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED', WITHDRAWN = 'WITHDRAWN', PUBLISHED = 'PUBLISHED',
  CORRECTED = 'CORRECTED', RETRACTED = 'RETRACTED',
}

export interface SubmissionProps {
  id: string
  journalId: string
  submittingAuthorId: string
  title: string
  abstract: string | null
  status: SubmissionStatus
  currentVersionId: string | null
  reviewRound: number
  submittedAt: Date | null
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Journal submission aggregate. Submitted versions are immutable; revisions
 * are represented by new SubmissionVersion records rather than overwrites.
 */
export class Submission {
  private constructor(private readonly props: SubmissionProps) {}

  public static create(props: Omit<SubmissionProps, 'status' | 'reviewRound' | 'submittedAt' | 'decidedAt' | 'updatedAt' | 'currentVersionId'> & { updatedAt?: Date }): Submission {
    if (!props.title.trim()) throw new Error('ERR_SUBMISSION_TITLE_REQUIRED')
    return new Submission({
      ...props,
      title: props.title.trim(),
      status: SubmissionStatus.DRAFT,
      currentVersionId: null,
      reviewRound: 0,
      submittedAt: null,
      decidedAt: null,
      updatedAt: props.updatedAt ?? props.createdAt,
    })
  }

  public static load(props: SubmissionProps): Submission { return new Submission({ ...props }) }
  public get id(): string { return this.props.id }
  public get journalId(): string { return this.props.journalId }
  public get submittingAuthorId(): string { return this.props.submittingAuthorId }
  public get title(): string { return this.props.title }
  public get abstract(): string | null { return this.props.abstract }
  public get status(): SubmissionStatus { return this.props.status }
  public get reviewRound(): number { return this.props.reviewRound }
  public get submittedAt(): Date | null { return this.props.submittedAt }
  public get decidedAt(): Date | null { return this.props.decidedAt }
  public get createdAt(): Date { return this.props.createdAt }
  public get updatedAt(): Date { return this.props.updatedAt }
  public get nextVersionNumber(): number { return this.props.reviewRound + 1 }
  public get currentVersionId(): string | null { return this.props.currentVersionId }
  public attachVersion(versionId: string): void { this.props.currentVersionId = versionId; this.props.updatedAt = new Date() }

  public submit(now = new Date()): void {
    this.assertStatus([SubmissionStatus.DRAFT, SubmissionStatus.RESUBMITTED])
    this.props.status = SubmissionStatus.SUBMITTED
    this.props.submittedAt = now
    this.props.updatedAt = now
  }

  public beginTechnicalCheck(): void { this.transition(SubmissionStatus.TECHNICAL_CHECK) }
  public beginEditorialScreening(): void { this.transition(SubmissionStatus.EDITORIAL_SCREENING) }
  public sendToReview(): void { this.transition(SubmissionStatus.UNDER_REVIEW) }

  public requestRevision(): void {
    this.assertStatus([SubmissionStatus.UNDER_REVIEW])
    this.props.status = SubmissionStatus.REVISION_REQUIRED
    this.props.updatedAt = new Date()
  }

  public resubmit(now = new Date()): void {
    this.assertStatus([SubmissionStatus.REVISION_REQUIRED])
    this.props.reviewRound += 1
    this.props.status = SubmissionStatus.RESUBMITTED
    this.props.submittedAt = now
    this.props.updatedAt = now
  }

  public accept(now = new Date()): void { this.decide(SubmissionStatus.ACCEPTED, now) }
  public reject(now = new Date()): void { this.decide(SubmissionStatus.REJECTED, now) }

  public withdraw(now = new Date()): void {
    this.assertStatus([SubmissionStatus.DRAFT, SubmissionStatus.SUBMITTED, SubmissionStatus.TECHNICAL_CHECK, SubmissionStatus.EDITORIAL_SCREENING, SubmissionStatus.UNDER_REVIEW, SubmissionStatus.REVISION_REQUIRED, SubmissionStatus.RESUBMITTED])
    this.props.status = SubmissionStatus.WITHDRAWN
    this.props.decidedAt = now
    this.props.updatedAt = now
  }

  private decide(status: SubmissionStatus, now: Date): void {
    this.assertStatus([SubmissionStatus.EDITORIAL_SCREENING, SubmissionStatus.UNDER_REVIEW])
    this.props.status = status
    this.props.decidedAt = now
    this.props.updatedAt = now
  }

  private transition(status: SubmissionStatus): void {
    this.assertStatus([SubmissionStatus.SUBMITTED, SubmissionStatus.TECHNICAL_CHECK, SubmissionStatus.EDITORIAL_SCREENING])
    this.props.status = status
    this.props.updatedAt = new Date()
  }

  private assertStatus(allowed: SubmissionStatus[]): void {
    if (!allowed.includes(this.props.status)) throw new Error('ERR_INVALID_SUBMISSION_STATE_TRANSITION')
  }
}
