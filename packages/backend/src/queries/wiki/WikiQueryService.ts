import { prisma } from '../../db'
import { WikiStatus } from '../../domain/wiki/Wiki'
import { PageStatus } from '../../domain/wiki/WikiPage'

/**
 * Wiki 查询服务，负责 Wiki 相关的读取操作
 */
export class WikiQueryService {
  /**
   * 检查用户是否可以访问 Wiki
   */
  private async canAccessWiki(wiki: any, userId?: string, userLevel: number = 0): Promise<boolean> {
    if (!wiki) return false
    if (wiki.status !== WikiStatus.ACTIVE) return false

    // 所有者可以访问
    if (userId && wiki.ownerId === userId) return true

    // 协作者可以访问
    if (userId) {
      const collaborator = await prisma.wikiCollaborator.findUnique({
        where: { wikiId_userId: { wikiId: wiki.id, userId } },
      })
      if (collaborator) return true
    }

    // 公开且用户等级满足要求可以访问
    if (wiki.isPublic && userLevel >= wiki.minReadLevel) return true

    return false
  }

  /**
   * 获取所有公开的活跃 Wiki
   */
  public async listPublicWikis(): Promise<any[]> {
    return prisma.wiki.findMany({
      where: { isPublic: true, status: WikiStatus.ACTIVE, minReadLevel: 0 },
      include: { owner: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 获取用户可访问的所有 Wiki
   */
  public async listWikisForUser(userId: string, userLevel: number): Promise<any[]> {
    return prisma.wiki.findMany({
      where: {
        status: WikiStatus.ACTIVE,
        OR: [
          { isPublic: true, minReadLevel: { lte: userLevel } },
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: { owner: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 获取用户拥有的 Wiki
   */
  public async listOwnedWikis(userId: string): Promise<any[]> {
    return prisma.wiki.findMany({
      where: { ownerId: userId, status: { not: WikiStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 获取 Wiki 详情
   */
  public async getWikiDetails(wikiId: string, userId?: string, userLevel: number = 0): Promise<any> {
    const wiki = await prisma.wiki.findUnique({
      where: { id: wikiId },
      include: { owner: { select: { id: true, username: true } } },
    })

    if (!wiki) return null

    const canAccess = await this.canAccessWiki(wiki, userId, userLevel)
    if (!canAccess) return null

    return wiki
  }

  /**
   * 获取 Wiki 的所有页面树
   */
  public async getWikiPages(wikiId: string, userId?: string, userLevel: number = 0): Promise<any[]> {
    const wiki = await prisma.wiki.findUnique({
      where: { id: wikiId },
    })

    if (!wiki) return []

    const canAccess = await this.canAccessWiki(wiki, userId, userLevel)
    if (!canAccess) return []

    const pages = await prisma.wikiPage.findMany({
      where: { wikiId, status: PageStatus.PUBLISHED },
      include: { author: { select: { id: true, username: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return this.buildPageTree(pages)
  }

  /**
   * 获取页面详情
   */
  public async getWikiPage(wikiId: string, slug: string, userId?: string, userLevel: number = 0): Promise<any> {
    const wiki = await prisma.wiki.findUnique({
      where: { id: wikiId },
    })

    if (!wiki) return null

    const canAccess = await this.canAccessWiki(wiki, userId, userLevel)
    if (!canAccess) return null

    return prisma.wikiPage.findFirst({
      where: { wikiId, slug, status: PageStatus.PUBLISHED },
      include: { author: { select: { id: true, username: true } }, lastEditor: { select: { id: true, username: true } } },
    })
  }

  /**
   * 按 ID 获取页面详情
   */
  public async getWikiPageById(wikiId: string, pageId: string, userId?: string, userLevel: number = 0): Promise<any> {
    const wiki = await prisma.wiki.findUnique({
      where: { id: wikiId },
    })

    if (!wiki) return null

    const canAccess = await this.canAccessWiki(wiki, userId, userLevel)
    if (!canAccess) return null

    return prisma.wikiPage.findFirst({
      where: { id: pageId, wikiId, status: PageStatus.PUBLISHED },
      include: { author: { select: { id: true, username: true } }, lastEditor: { select: { id: true, username: true } } },
    })
  }

  /**
   * 获取 Wiki 协作者列表
   */
  public async getWikiCollaborators(wikiId: string, userId?: string, userLevel: number = 0): Promise<any[]> {
    const wiki = await prisma.wiki.findUnique({
      where: { id: wikiId },
    })

    if (!wiki) return []

    const canAccess = await this.canAccessWiki(wiki, userId, userLevel)
    if (!canAccess) return []

    return prisma.wikiCollaborator.findMany({
      where: { wikiId },
      include: { user: { select: { id: true, username: true } } },
    })
  }

  /**
   * 构建页面树形结构
   */
  private buildPageTree(pages: any[]): any[] {
    const pageMap = new Map<string, any>()
    const rootPages: any[] = []

    pages.forEach(page => {
      pageMap.set(page.id, { ...page, children: [] })
    })

    pages.forEach(page => {
      const node = pageMap.get(page.id)
      if (page.parentId) {
        const parent = pageMap.get(page.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          rootPages.push(node)
        }
      } else {
        rootPages.push(node)
      }
    })

    return rootPages
  }
}
