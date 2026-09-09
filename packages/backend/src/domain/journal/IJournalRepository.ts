import { Submission } from './Submission'
import { SubmissionVersion } from './SubmissionVersion'

export interface IJournalRepository {
  journalExists(id: string): Promise<boolean>
  isEditor(journalId: string, userId: string): Promise<boolean>
  getSubmissionAuthorIds(submissionId: string): Promise<string[]>
  canAuthorUploadVersion(versionId: string, userId: string): Promise<boolean>
  versionBelongsToSubmission(versionId: string, submissionId: string): Promise<boolean>
  findSubmissionById(id: string): Promise<Submission | null>
  saveSubmission(submission: Submission): Promise<void>
  saveVersion(version: SubmissionVersion): Promise<void>
  countSubmittedReviews(versionId: string): Promise<number>
}
