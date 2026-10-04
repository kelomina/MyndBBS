import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { auditApplicationService } from '../registry'
import { pluginApplicationService } from '../application/system/PluginApplicationService'
import { pluginEventBridge } from '../infrastructure/plugins/PluginEventBridge'

function param(req: AuthRequest, name: string): string {
  const value = req.params[name]
  if (typeof value !== 'string' || !value) throw new Error('ERR_BAD_REQUEST')
  return value
}

function sendPluginError(res: Response, error: unknown): void {
  const code =
    error instanceof Error && /^ERR_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR'
  const status =
    code === 'ERR_PLUGIN_OPERATION_IN_PROGRESS' ||
    code === 'ERR_PLUGIN_MUST_BE_DISABLED' ||
    code === 'ERR_PLUGIN_NOT_ACTIVE' ||
    code === 'ERR_PLUGIN_RELEASE_NOT_PENDING_APPROVAL'
      ? 409
      : code.includes('NOT_FOUND')
        ? 404
        : code.includes('FORBIDDEN')
          ? 403
          : code.includes('UNAVAILABLE') || code.includes('CONTROL_FAILED')
            ? 503
            : code.includes('INVALID') ||
                code.includes('MISSING') ||
                code.includes('REQUIRED') ||
                code.includes('NOT_APPROVED')
              ? 400
              : 500
  res.status(status).json({ error: code })
}

async function audit(
  req: AuthRequest,
  operationType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!req.user) return
  await auditApplicationService.logAudit(
    req.user.userId,
    operationType,
    'plugin-platform',
    'PLUGIN',
    req.originalUrl || req.path,
    req.ip || '127.0.0.1',
    payload,
  )
}

export async function listPlugins(_req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await pluginApplicationService.list())
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function getPlugin(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await pluginApplicationService.get(param(req, 'pluginId')))
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function uploadPluginRelease(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'ERR_PLUGIN_ARTIFACT_MISSING' })
      return
    }
    const signatureText = typeof req.body?.signature === 'string' ? req.body.signature : ''
    if (!signatureText) {
      res.status(400).json({ error: 'ERR_PLUGIN_SIGNATURE_MISSING' })
      return
    }
    if (
      !/^[A-Za-z0-9+/]{86}==$/.test(signatureText) ||
      Buffer.from(signatureText, 'base64').length !== 64
    ) {
      res.status(400).json({ error: 'ERR_INVALID_PLUGIN_SIGNATURE' })
      return
    }
    const result = await pluginApplicationService.stageRelease({
      fileName: req.file.originalname,
      archive: req.file.buffer,
      signature: Buffer.from(signatureText, 'base64'),
      requestedBy: req.user!.userId,
    })
    await audit(req, 'PLUGIN_UPLOAD', {
      pluginId: result.pluginId,
      version: result.releases[0]?.version,
    })
    res.status(201).json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function approvePluginRelease(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pluginApplicationService.approve(
      param(req, 'pluginId'),
      param(req, 'releaseId'),
      req.user!.userId,
    )
    await audit(req, 'PLUGIN_APPROVE', {
      pluginId: param(req, 'pluginId'),
      releaseId: param(req, 'releaseId'),
    })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function activatePlugin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (
      req.body?.version !== undefined &&
      (typeof req.body.version !== 'string' || !req.body.version.trim())
    ) {
      res.status(400).json({ error: 'ERR_PLUGIN_VERSION_REQUIRED' })
      return
    }
    const version =
      typeof req.body?.version === 'string' && req.body.version.trim()
        ? req.body.version.trim()
        : undefined
    const result = await pluginApplicationService.activate(param(req, 'pluginId'), version)
    await audit(req, 'PLUGIN_ACTIVATE', {
      pluginId: param(req, 'pluginId'),
      version: version ?? null,
    })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function deactivatePlugin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pluginApplicationService.deactivate(param(req, 'pluginId'))
    await audit(req, 'PLUGIN_DEACTIVATE', { pluginId: param(req, 'pluginId') })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function removePlugin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pluginApplicationService.remove(param(req, 'pluginId'))
    await audit(req, 'PLUGIN_REMOVE', { pluginId: param(req, 'pluginId') })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function reloadPlugin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pluginApplicationService.reload(param(req, 'pluginId'))
    await audit(req, 'PLUGIN_RELOAD', { pluginId: param(req, 'pluginId') })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function rollbackPlugin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (typeof req.body?.version !== 'string' || !req.body.version.trim()) {
      res.status(400).json({ error: 'ERR_PLUGIN_VERSION_REQUIRED' })
      return
    }
    const result = await pluginApplicationService.rollback(
      param(req, 'pluginId'),
      req.body.version.trim(),
    )
    await audit(req, 'PLUGIN_ROLLBACK', {
      pluginId: param(req, 'pluginId'),
      version: req.body.version.trim(),
    })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function getPluginHealth(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await pluginApplicationService.health(param(req, 'pluginId')))
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function getPluginConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await pluginApplicationService.getConfig(param(req, 'pluginId')))
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function updatePluginConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pluginApplicationService.updateConfig(
      param(req, 'pluginId'),
      req.body,
      req.user!.userId,
    )
    await audit(req, 'PLUGIN_CONFIG_UPDATE', { pluginId: param(req, 'pluginId') })
    res.json(result)
  } catch (error) {
    sendPluginError(res, error)
  }
}

export async function getPluginEventBacklog(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await pluginEventBridge.backlog(param(req, 'pluginId')))
  } catch (error) {
    sendPluginError(res, error)
  }
}
