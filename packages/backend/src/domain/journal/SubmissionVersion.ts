export interface SubmissionVersionProps {
  id: string; submissionId: string; versionNumber: number; title: string
  abstract: string | null; createdById: string; createdAt: Date
}

export class SubmissionVersion {
  private constructor(private readonly props: SubmissionVersionProps) {}
  public static create(props: SubmissionVersionProps): SubmissionVersion {
    if (props.versionNumber < 1) throw new Error('ERR_INVALID_SUBMISSION_VERSION')
    if (!props.title.trim()) throw new Error('ERR_SUBMISSION_TITLE_REQUIRED')
    return new SubmissionVersion({ ...props, title: props.title.trim() })
  }
  public static load(props: SubmissionVersionProps): SubmissionVersion { return new SubmissionVersion({ ...props }) }
  public get id(): string { return this.props.id }
  public get submissionId(): string { return this.props.submissionId }
  public get versionNumber(): number { return this.props.versionNumber }
  public get title(): string { return this.props.title }
  public get abstract(): string | null { return this.props.abstract }
  public get createdById(): string { return this.props.createdById }
  public get createdAt(): Date { return this.props.createdAt }
}
