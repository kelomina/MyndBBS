import { IUnitOfWork } from '../../domain/shared/IUnitOfWork'
import { EditorialPolicy } from '../../domain/journal/EditorialPolicy'
import { IJournalRepository } from '../../domain/journal/IJournalRepository'
import { Submission } from '../../domain/journal/Submission'

export type EditorialDecision = 'DESK_REJECT' | 'REJECT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'ACCEPT'

export interface EditorialDecisionPersistence {
  saveDecision(input: { id: string; submissionId: string; versionId: string; editorId: string; decision: EditorialDecision; reason: string; round: number }): Promise<void>
}

export class EditorialDecisionApplicationService {
  constructor(private readonly journal: IJournalRepository, private readonly decisions: EditorialDecisionPersistence, private readonly unitOfWork: IUnitOfWork) {}

  public async decide(input: { submissionId: string; versionId: string; editorId: string; decision: EditorialDecision; reason: string }): Promise<Submission> {
    return this.unitOfWork.execute(async () => {
      if (!input.reason.trim()) throw new Error('ERR_EDITORIAL_DECISION_REASON_REQUIRED')
      const submission = await this.journal.findSubmissionById(input.submissionId)
      if (!submission) throw new Error('ERR_SUBMISSION_NOT_FOUND')
      if (!(await this.journal.isEditor(submission.journalId, input.editorId))) throw new Error('ERR_FORBIDDEN_JOURNAL_EDITOR_ONLY')
      if (!(await this.journal.versionBelongsToSubmission(input.versionId, input.submissionId))) throw new Error('ERR_VERSION_NOT_IN_SUBMISSION')
      if (input.decision !== 'DESK_REJECT') {
        EditorialPolicy.assertEnoughReviews(await this.journal.countSubmittedReviews(input.versionId))
      }
      if (input.decision === 'DESK_REJECT') { if (submission.status !== 'EDITORIAL_SCREENING') throw new Error('ERR_INVALID_SUBMISSION_STATE'); submission.reject() }
      else if (input.decision === 'ACCEPT') { if (submission.status !== 'UNDER_REVIEW') throw new Error('ERR_INVALID_SUBMISSION_STATE'); submission.accept() }
      else if (input.decision === 'REJECT') { if (submission.status !== 'UNDER_REVIEW') throw new Error('ERR_INVALID_SUBMISSION_STATE'); submission.reject() }
      else { if (submission.status !== 'UNDER_REVIEW') throw new Error('ERR_INVALID_SUBMISSION_STATE'); submission.requestRevision() }
      await this.decisions.saveDecision({ id: crypto.randomUUID(), submissionId: submission.id, versionId: input.versionId, editorId: input.editorId, decision: input.decision, reason: input.reason.trim(), round: submission.reviewRound })
      await this.journal.saveSubmission(submission)
      return submission
    })
  }
}
