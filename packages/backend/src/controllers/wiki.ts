/**
 * Wiki Controller
 * Handles Wiki and Wiki Page operations.
 *
 * 函数作用：
 *   Wiki 和 Wiki Page 相关 API 请求处理器，包括 Wiki CRUD、协作者管理、页面 CRUD、历史版本。
 * Purpose:
 *   Wiki and Wiki Page API request handlers including CRUD operations,
 *   collaborator management, page CRUD, and version history.
 *
 * 中文关键词：
 *   wiki, 控制器, 页面, 协作者, 历史版本
 * English keywords:
 *   wiki, controller, page, collaborator, version history
 *
 * 调用方 / Called by:
 *   routes/wiki.ts
 *
 * 被调用方 / Calls:
 *   wikiApplicationService, wikiPageApplicationService, wikiQueryService, prisma
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

import { wikiApplicationService, wikiPageApplicationService } from '../registry';
import { WikiQueryService } from '../queries/wiki/WikiQueryService';
import { prisma } from '../db';

const wikiQueryService = new WikiQueryService();

/**
 * 获取当前会话的有效等级。
 * 账号真实等级仍在数据库里；这里使用认证中间件按当前 session 计算出的临时等级。
 */
function getSessionUserLevel(req: AuthRequest): number {
  return req.user?.effectiveLevel ?? 0;
}

/**
 * 获取 Wiki 列表
 */
export const getWikiList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let wikis;
    if (req.user) {
      const userLevel = getSessionUserLevel(req);
      wikis = await wikiQueryService.listWikisForUser(req.user.userId, userLevel);
    } else {
      wikis = await wikiQueryService.listPublicWikis();
    }
    res.json(wikis);
  } catch (error) {
    console.error('Error fetching wikis:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_WIKIS' });
  }
};

/**
 * 创建 Wiki
 */
export const createWiki = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, coverUrl } = req.body;
    const userLevel = getSessionUserLevel(req);
    const wiki = await wikiApplicationService.createWiki(
      title,
      description,
      coverUrl,
      req.user!.userId,
      userLevel,
    );
    res.json(wiki);
  } catch (error: any) {
    console.error('Error creating wiki:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_WIKI' });
    }
  }
};

/**
 * 获取 Wiki 详情
 */
export const getWikiDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const userId = req.user?.userId;
    const userLevel = userId ? getSessionUserLevel(req) : 0;
    const wiki = await wikiQueryService.getWikiDetails(wikiId, userId, userLevel);
    if (!wiki) {
      res.status(404).json({ error: 'ERR_WIKI_NOT_FOUND' });
      return;
    }
    res.json(wiki);
  } catch (error) {
    console.error('Error fetching wiki:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_WIKI' });
  }
};

/**
 * 更新 Wiki
 */
export const updateWiki = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const { title, description, coverUrl } = req.body;
    await wikiApplicationService.updateWiki(
      req.ability!,
      wikiId,
      title,
      description,
      coverUrl,
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating wiki:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_WIKI' });
    }
  }
};

/**
 * 更新 Wiki 权限设置
 */
export const updateWikiPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const { minReadLevel, minEditLevel, isPublic } = req.body;
    await wikiApplicationService.updateWikiPermissions(
      req.ability!,
      wikiId,
      minReadLevel,
      minEditLevel,
      isPublic,
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating wiki permissions:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_WIKI_PERMISSIONS' });
    }
  }
};

/**
 * 删除 Wiki
 */
export const deleteWiki = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    await wikiApplicationService.deleteWiki(req.ability!, wikiId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting wiki:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_WIKI' });
    }
  }
};

/**
 * 获取 Wiki 协作者列表
 */
export const getWikiCollaborators = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const userId = req.user?.userId;
    const userLevel = userId ? getSessionUserLevel(req) : 0;
    const collaborators = await wikiQueryService.getWikiCollaborators(wikiId, userId, userLevel);
    res.json(collaborators);
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_COLLABORATORS' });
  }
};

/**
 * 添加协作者
 */
export const addCollaborator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const { userId, role } = req.body;
    await wikiApplicationService.addCollaborator(req.ability!, wikiId, userId, role);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding collaborator:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_ADD_COLLABORATOR' });
    }
  }
};

/**
 * 更新协作者权限
 */
export const updateCollaborator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const userId = req.params.userId as string;
    const { role } = req.body;
    await wikiApplicationService.updateCollaboratorRole(req.ability!, wikiId, userId, role);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating collaborator:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_COLLABORATOR' });
    }
  }
};

/**
 * 移除协作者
 */
export const removeCollaborator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const userId = req.params.userId as string;
    await wikiApplicationService.removeCollaborator(req.ability!, wikiId, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing collaborator:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_REMOVE_COLLABORATOR' });
    }
  }
};

/**
 * 获取 Wiki 页面树
 */
export const getWikiPages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const userId = req.user?.userId;
    const userLevel = userId ? getSessionUserLevel(req) : 0;
    const pages = await wikiQueryService.getWikiPages(wikiId, userId, userLevel);
    res.json(pages);
  } catch (error) {
    console.error('Error fetching wiki pages:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_WIKI_PAGES' });
  }
};

/**
 * 创建 Wiki 页面
 */
export const createWikiPage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const { title, slug, content, parentId } = req.body;
    const userLevel = getSessionUserLevel(req);
    const page = await wikiPageApplicationService.createPage(
      req.ability!,
      wikiId,
      title,
      slug,
      content,
      parentId,
      req.user!.userId,
      userLevel,
    );
    res.json(page);
  } catch (error: any) {
    console.error('Error creating wiki page:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_WIKI_PAGE' });
    }
  }
};

/**
 * 获取 Wiki 页面详情
 */
export const getWikiPage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const slug = req.params.slug as string;
    const userId = req.user?.userId;
    const userLevel = userId ? getSessionUserLevel(req) : 0;
    const page = await wikiQueryService.getWikiPage(wikiId, slug, userId, userLevel);
    if (!page) {
      res.status(404).json({ error: 'ERR_WIKI_PAGE_NOT_FOUND' });
      return;
    }
    res.json(page);
  } catch (error) {
    console.error('Error fetching wiki page:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_WIKI_PAGE' });
  }
};

/**
 * 按 ID 获取 Wiki 页面详情
 */
export const getWikiPageById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const pageId = req.params.pageId as string;
    const userId = req.user?.userId;
    const userLevel = userId ? getSessionUserLevel(req) : 0;
    const page = await wikiQueryService.getWikiPageById(wikiId, pageId, userId, userLevel);
    if (!page) {
      res.status(404).json({ error: 'ERR_WIKI_PAGE_NOT_FOUND' });
      return;
    }
    res.json(page);
  } catch (error) {
    console.error('Error fetching wiki page by id:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_WIKI_PAGE' });
  }
};

/**
 * 更新 Wiki 页面
 */
export const updateWikiPage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pageId = req.params.pageId as string;
    const { title, content, slug, editNote } = req.body;
    const userLevel = getSessionUserLevel(req);
    await wikiPageApplicationService.updatePage(
      req.ability!,
      pageId,
      title,
      content,
      slug,
      req.user!.userId,
      userLevel,
      editNote,
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating wiki page:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_WIKI_PAGE' });
    }
  }
};

/**
 * 删除 Wiki 页面
 */
export const deleteWikiPage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pageId = req.params.pageId as string;
    const userLevel = getSessionUserLevel(req);
    await wikiPageApplicationService.deletePage(
      req.ability!,
      pageId,
      req.user!.userId,
      userLevel,
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting wiki page:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_WIKI_PAGE' });
    }
  }
};

/**
 * 获取页面历史
 */
export const getPageHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wikiId = req.params.wikiId as string;
    const pageId = req.params.pageId as string;
    const userLevel = getSessionUserLevel(req);
    const history = await wikiPageApplicationService.getPageHistory(
      req.ability!,
      wikiId,
      pageId,
      req.user!.userId,
      userLevel,
    );
    res.json(history);
  } catch (error: any) {
    console.error('Error fetching page history:', error);
    if (error.message?.startsWith('ERR_')) {
      res.status(error.message === 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS' ? 403 : 404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_PAGE_HISTORY' });
  }
};

/**
 * 获取 Wiki 创建限制信息
 */
export const getCreationLimit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userLevel = getSessionUserLevel(req);

    const limitRecord = await prisma.wikiCreationLimit.findUnique({
      where: { userId }
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const creationTimes = limitRecord?.creationTimes as string[] || [];
    const currentCount = creationTimes.filter(time => new Date(time) > sevenDaysAgo).length;

    let maxCount = 1;
    if (userLevel >= 6) {
      maxCount = 3;
    } else if (userLevel >= 4) {
      maxCount = 2;
    }

    const canCreate = userLevel >= 2 && currentCount < maxCount;

    res.json({
      currentCount,
      maxCount,
      canCreate,
      userLevel
    });
  } catch (error) {
    console.error('Error fetching wiki creation limit:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_CREATION_LIMIT' });
  }
};

/**
 * 获取用户自己的 Wiki 列表
 */
export const getMyWikis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const wikis = await prisma.wiki.findMany({
      where: { ownerId: userId },
      include: { owner: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(wikis);
  } catch (error) {
    console.error('Error fetching my wikis:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_MY_WIKIS' });
  }
};

/**
 * 恢复历史版本
 */
export const restorePageHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const historyId = req.params.historyId as string;
    const userLevel = getSessionUserLevel(req);
    await wikiPageApplicationService.restorePageHistory(
      req.ability!,
      historyId,
      req.user!.userId,
      userLevel,
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error restoring page history:', error);
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_RESTORE_PAGE_HISTORY' });
    }
  }
};
