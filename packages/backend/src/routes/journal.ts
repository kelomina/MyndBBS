import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { createJournalSubmissionSchema, assignJournalReviewerSchema, submitJournalReviewSchema } from '../lib/validation/schemas'
import { createSubmission, submitSubmission, withdrawSubmission, assignReviewer, submitReview, uploadSubmissionPdf } from '../controllers/journal'
import { submissionFileRepository, submissionStorage } from '../registry'

const router: Router = Router()
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
router.post('/journals/:journalId/submissions', requireAuth, validate(createJournalSubmissionSchema), createSubmission)
router.post('/submissions/:id/submit', requireAuth, submitSubmission)
router.post('/submissions/:id/withdraw', requireAuth, withdrawSubmission)
router.post('/submissions/:id/reviewers', requireAuth, validate(assignJournalReviewerSchema), assignReviewer)
router.post('/reviewer/assignments/:id/review', requireAuth, validate(submitJournalReviewSchema), submitReview)
router.post('/submissions/:id/file', requireAuth, pdfUpload.single('file'), uploadSubmissionPdf)
router.get('/submission-files/:id', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { user?: { userId?: string } }).user?.userId
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
  const file = await submissionFileRepository.getAuthorizedFile(req.params.id as string, userId)
  if (!file) { res.status(404).json({ error: 'ERR_SUBMISSION_FILE_NOT_FOUND' }); return }
  const content = await submissionStorage.read(file.storageKey)
  res.type('application/pdf').attachment(file.originalName).send(content)
})
export default router
