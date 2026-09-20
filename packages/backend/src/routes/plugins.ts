import { Router, type RequestHandler } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { proxyPluginRequest } from '../infrastructure/plugins/PluginGateway'

const router = Router()
const pluginAuth: RequestHandler = requireAuth as RequestHandler

// Mounted at /api/plugins. The parameterized middleware preserves arbitrary plugin route suffixes.
router.use('/:pluginId', pluginAuth, (req, res) => {
  void proxyPluginRequest(req as AuthRequest, res)
})

export default router
