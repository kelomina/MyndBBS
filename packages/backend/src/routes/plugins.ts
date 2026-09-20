import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { proxyPluginRequest } from '../infrastructure/plugins/PluginGateway'

const router = Router()

// Mounted at /api/plugins. The parameterized middleware preserves arbitrary plugin route suffixes.
router.use('/:pluginId', requireAuth, (req, res) => {
  void proxyPluginRequest(req as AuthRequest, res)
})

export default router
