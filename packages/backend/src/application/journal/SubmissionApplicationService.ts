import { randomUUID } from 'crypto'
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork'
import { IJournalRepository } from '../../domain/journal/IJournalRepository'
import { Submission } from '../../domain/journal/Submission'
import { SubmissionVersion } from '../../domain/journal/SubmissionVersion'

export class SubmissionApplicationService {
  constructor(private readonly repository: IJournalRepository, private readonly unitOfWork: IUnitOfWork) {}

  public async createDraft(input: { journalId: string; authorId: string; title: string; abstract?: string | null }): Promise<Submission> {
    return this.unitOfWork.execute(async () => {
      if (!(await this.repository.journalExists(input.journalId))) throw new Error('ERR_JOURNAL_NOT_FOUND')
      const now = new Date()
      const submission = Submission.create({ id: randomUUID(), journalId: input.journalId, submittingAuthorId: input.authorId, title: input.title, abstract: input.abstract ?? null, createdAt: now })
      const version = SubmissionVersion.create({ id: randomUUID(), submissionId: submission.id, versionNumber: 1, title: submission.title, abstract: submission.abstract, createdById: input.authorId, createdAt: now })
      submission.attachVersion(version.id)
      await this.repository.saveSubmission(submission)
      await this.repository.saveVersion(version)
      return submission
    })
  }

  public async submit(submissionId: string, authorId: string): Promise<Submission> {
    return this.unitOfWork.execute(async () => {
      const submission = await this.repository.findSubmissionById(submissionId)
      if (!submission) throw new Error('ERR_SUBMISSION_NOT_FOUND')
      if (submission.submittingAuthorId !== authorId) throw new Error('ERR_FORBIDDEN_SUBMISSION_OWNER_ONLY')
      const version = submission.currentVersionId ? null : SubmissionVersion.create({ id: randomUUID(), submissionId, versionNumber: submission.nextVersionNumber, title: submission.title, abstract: submission.abstract, createdById: authorId, createdAt: new Date() })
      submission.submit()
      if (version) { submission.attachVersion(version.id); await this.repository.saveVersion(version) }
      await this.repository.saveSubmission(submission)
      return submission
    })
  }

  public async withdraw(submissionId: string, authorId: string): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const submission = await this.repository.findSubmissionById(submissionId)
      if (!submission) throw new Error('ERR_SUBMISSION_NOT_FOUND')
      if (submission.submittingAuthorId !== authorId) throw new Error('ERR_FORBIDDEN_SUBMISSION_OWNER_ONLY')
      submission.withdraw()
      await this.repository.saveSubmission(submission)
    })
  }
}
