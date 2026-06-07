/**
 * 路由模块：Wiki
 *
 * 函数作用：
 *   Wiki 和 Wiki Page 相关 API 路由，包括 Wiki CRUD、协作者管理、页面 CRUD、历史版本。
 *
 * Purpose:
 *   Wiki and Wiki Page API routes including CRUD operations, collaborator management,
 *   page CRUD, and version history.
 *
 * 路由前缀 / Route prefix:
 *   /api/wikis
 *
 * 中文关键词：
 *   wiki, 页面, 协作者, 历史版本
 * English keywords:
 *   wiki, page, collaborator, version history
 */
import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { postLimiter, publicReadLimiter } from '../lib/rateLimit';
import { validate } from '../middleware/validation';
import {
  addWikiCollaboratorSchema,
  createWikiPageSchema,
  createWikiSchema,
  updateWikiCollaboratorSchema,
  updateWikiPageSchema,
  updateWikiPermissionsSchema,
  updateWikiSchema,
} from '../lib/validation/schemas';

import {
  getWikiList,
  createWiki,
  getWikiDetails,
  updateWiki,
  updateWikiPermissions,
  deleteWiki,
  getWikiCollaborators,
  addCollaborator,
  updateCollaborator,
  removeCollaborator,
  getWikiPages,
  createWikiPage,
  getWikiPage,
  getWikiPageById,
  updateWikiPage,
  deleteWikiPage,
  getPageHistory,
  restorePageHistory,
  getCreationLimit,
  getMyWikis
} from '../controllers/wiki';

const router: Router = Router();

// ── Wiki 列表 ──
router.get('/', publicReadLimiter, optionalAuth, getWikiList);
router.get('/my', requireAuth, getMyWikis);
router.get('/creation-limit', requireAuth, getCreationLimit);
router.post('/', requireAuth, postLimiter, validate(createWikiSchema), createWiki);

// ── Wiki 详情 ──
router.get('/:wikiId', publicReadLimiter, optionalAuth, getWikiDetails);
router.put('/:wikiId', requireAuth, validate(updateWikiSchema), updateWiki);
router.put('/:wikiId/permissions', requireAuth, validate(updateWikiPermissionsSchema), updateWikiPermissions);
router.delete('/:wikiId', requireAuth, deleteWiki);

// ── Wiki 协作者 ──
router.get('/:wikiId/collaborators', requireAuth, getWikiCollaborators);
router.post('/:wikiId/collaborators', requireAuth, validate(addWikiCollaboratorSchema), addCollaborator);
router.put('/:wikiId/collaborators/:userId', requireAuth, validate(updateWikiCollaboratorSchema), updateCollaborator);
router.delete('/:wikiId/collaborators/:userId', requireAuth, removeCollaborator);

// ── Wiki 页面 ──
router.get('/:wikiId/pages', publicReadLimiter, optionalAuth, getWikiPages);
router.post('/:wikiId/pages', requireAuth, postLimiter, validate(createWikiPageSchema), createWikiPage);
router.get('/:wikiId/pages/:pageId/history', requireAuth, getPageHistory);
router.post('/:wikiId/pages/:pageId/history/:historyId/restore', requireAuth, restorePageHistory);
router.get('/:wikiId/pages/:pageId', publicReadLimiter, optionalAuth, getWikiPageById);
router.put('/:wikiId/pages/:pageId', requireAuth, validate(updateWikiPageSchema), updateWikiPage);
router.delete('/:wikiId/pages/:pageId', requireAuth, deleteWikiPage);

export default router;
