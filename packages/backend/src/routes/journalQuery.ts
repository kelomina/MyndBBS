import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { journalQueryService } from '../queries/journal/JournalQueryService'

type Req = Request & { user?: { userId?: string } }
const router: Router = Router()

router.get('/journals', async (_req, res) => { res.json(await journalQueryService.listPublic()) })
router.get('/journals/by-slug/:slug', async (req, res) => {
  const journal = await journalQueryService.getPublicBySlug(req.params.slug as string)
  if (!journal) { res.status(404).json({ error: 'ERR_JOURNAL_NOT_FOUND' }); return }
  res.json(journal)
})
router.get('/journals/:journalId/submissions/mine', requireAuth, async (req: Req, res: Response) => {
  const userId = req.user?.userId
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
  res.json(await journalQueryService.getForAuthor(req.params.journalId as string, userId))
})
router.get('/journals/:journalId/editor/submissions', requireAuth, async (req: Req, res: Response) => {
  const userId = req.user?.userId
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
  try { res.json(await journalQueryService.getForEditor(req.params.journalId as string, userId)) }
  catch (e) { res.status(403).json({ error: e instanceof Error ? e.message : 'ERR_FORBIDDEN' }) }
})
router.get('/reviewer/assignments', requireAuth, async (req: Req, res: Response) => {
  const userId = req.user?.userId
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
  res.json(await journalQueryService.getReviewerAssignments(userId))
})
router.get('/submissions/:id', requireAuth, async (req: Req, res: Response) => {
  const userId = req.user?.userId
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
  const item = await journalQueryService.getSubmissionForAuthor(req.params.id as string, userId)
  if (!item) { res.status(404).json({ error: 'ERR_SUBMISSION_NOT_FOUND' }); return }
  res.json(item)
})
router.get('/reviewer/assignments/:id', requireAuth, async (req: Req, res: Response) => {
  const userId = req.user?.userId
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return }
  const item = await journalQueryService.getAssignmentForReviewer(req.params.id as string, userId)
  if (!item) { res.status(404).json({ error: 'ERR_REVIEW_ASSIGNMENT_NOT_FOUND' }); return }
  res.json(item)
})
export default router
