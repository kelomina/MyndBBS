import { Request, Response } from 'express'
import { submissionApplicationService, reviewApplicationService, submissionFileApplicationService, journalAccessRepository } from '../registry'
import { assertSubmissionPdf } from '../domain/journal/PdfSubmissionPolicy'

type AuthenticatedRequest = Request & { user?: { userId?: string } }

export const createSubmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authorId = req.user?.userId
    if (!authorId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
    const submission = await submissionApplicationService.createDraft({ journalId: req.params.journalId as string, authorId, title: req.body.title, abstract: req.body.abstract })
    res.status(201).json({ id: submission.id, status: submission.status, title: submission.title, currentVersionId: submission.currentVersionId })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'ERR_INTERNAL_SERVER_ERROR' }) }
}

export const submitSubmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authorId = req.user?.userId
    if (!authorId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
    const submission = await submissionApplicationService.submit(req.params.id as string, authorId)
    res.json({ id: submission.id, status: submission.status, versionNumber: submission.nextVersionNumber - 1 })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'ERR_INTERNAL_SERVER_ERROR' }) }
}

export const withdrawSubmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authorId = req.user?.userId
    if (!authorId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
    await submissionApplicationService.withdraw(req.params.id as string, authorId)
    res.json({ success: true })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'ERR_INTERNAL_SERVER_ERROR' }) }
}

export const assignReviewer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const editorId = req.user?.userId
    if (!editorId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
    const assignment = await reviewApplicationService.assignReviewer({ submissionId: req.params.id as string, versionId: req.body.versionId, reviewerId: req.body.reviewerId, editorId, authorIds: [], dueAt: new Date(req.body.dueAt) })
    res.status(201).json({ id: assignment.id, status: assignment.currentStatus, dueAt: assignment.dueAt })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'ERR_INTERNAL_SERVER_ERROR' }) }
}

export const submitReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reviewerId = req.user?.userId
    if (!reviewerId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
    const review = await reviewApplicationService.submitReview({ ...req.body, id: req.body.id ?? crypto.randomUUID(), assignmentId: req.params.id as string, reviewerId, submittedAt: new Date() })
    res.status(201).json({ id: review.id, recommendation: review.recommendation })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'ERR_INTERNAL_SERVER_ERROR' }) }
}

export const uploadSubmissionPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId
    const file = (req as AuthenticatedRequest & { file?: { originalname: string; mimetype: string; buffer: Buffer } }).file
    if (!userId || !file) { res.status(400).json({ error: 'ERR_SUBMISSION_PDF_REQUIRED' }); return }
    const versionId = req.body.versionId as string
    assertSubmissionPdf({ originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.buffer.byteLength, header: file.buffer.subarray(0, 5) })
    const result = await submissionFileApplicationService.uploadPdfForAuthor({ userId, versionId, journalId: req.body.journalId, submissionId: req.params.id as string, originalName: file.originalname, mimeType: file.mimetype, content: file.buffer, canUpload: (id, author) => journalAccessRepository.canAuthorUploadVersion(id, author) })
    res.status(201).json({ id: result.id, sizeBytes: result.sizeBytes, sha256: result.sha256 })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'ERR_INTERNAL_SERVER_ERROR' }) }
}
