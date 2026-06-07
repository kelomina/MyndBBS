import { randomUUID as uuidv4 } from 'crypto'
import { AnyAbility, subject } from '@casl/ability'
import { IWikiRepository } from '../../domain/wiki/IWikiRepository'
import { IWikiPageRepository } from '../../domain/wiki/IWikiPageRepository'
import { IWikiCollaboratorRepository } from '../../domain/wiki/IWikiCollaboratorRepository'
import { WikiPage } from '../../domain/wiki/WikiPage'
import { WikiStatus } from '../../domain/wiki/Wiki'
import { CollaboratorRole } from '../../domain/wiki/WikiCollaborator'
import { prisma } from '../../db'
import { COLLABORATOR_ONLY_EDIT_LEVEL, MIN_PUBLIC_EDIT_LEVEL } from './WikiApplicationService'

export interface WikiPageApplicationServiceOptions {
  wikiRepository: IWikiRepository
  pageRepository: IWikiPageRepository
  collaboratorRepository: IWikiCollaboratorRepository
}
export class WikiPageApplicationService {
  constructor(private readonly opts: WikiPageApplicationServiceOptions) {}

  private static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  public async createPage(
    ability: AnyAbility,
    wikiId: string,
    title: string,
    slug: string,
    content: string,
    parentId: string | null,
    authorId: string,
    userLevel: number,
  ): Promise<WikiPage> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')
    if (wiki.status !== WikiStatus.ACTIVE) throw new Error('ERR_WIKI_NOT_ACTIVE')

    const hasPermission = await this.checkEditPermission(wikiId, authorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    const finalSlug = slug && slug.trim().length > 0 ? WikiPageApplicationService.slugify(slug) : WikiPageApplicationService.slugify(title)

    const page = WikiPage.create({
      id: uuidv4(),
      wikiId,
      slug: finalSlug,
      title,
      content,
      parentId,
      authorId,
      sortOrder: 0,
    })

    await this.opts.pageRepository.save(page)

    await prisma.wikiPageHistory.create({
      data: {
        id: uuidv4(),
        pageId: page.id,
        content,
        editorId: authorId,
        editNote: 'Initial version',
      },
    })

    return page
  }

  public async updatePage(
    ability: AnyAbility,
    pageId: string,
    title: string,
    content: string,
    slug: string,
    editorId: string,
    userLevel: number,
    editNote?: string,
  ): Promise<void> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const wiki = await this.opts.wikiRepository.findById(page.wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    await prisma.wikiPageHistory.create({
      data: {
        id: uuidv4(),
        pageId,
        content: page.content,
        editorId: page.lastEditorId || page.authorId,
        editNote: editNote || 'Update',
      },
    })

    const finalSlug = slug && slug.trim().length > 0 ? WikiPageApplicationService.slugify(slug) : WikiPageApplicationService.slugify(title)

    page.updateContent(title, content, finalSlug, editorId)
    await this.opts.pageRepository.save(page)
  }

  public async movePage(
    ability: AnyAbility,
    pageId: string,
    parentId: string | null,
    sortOrder: number,
    editorId: string,
    userLevel: number,
  ): Promise<void> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    page.move(parentId, sortOrder)
    await this.opts.pageRepository.save(page)
  }

  public async publishPage(
    ability: AnyAbility,
    pageId: string,
    editorId: string,
    userLevel: number,
  ): Promise<void> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    page.publish()
    await this.opts.pageRepository.save(page)
  }

  public async archivePage(
    ability: AnyAbility,
    pageId: string,
    editorId: string,
    userLevel: number,
  ): Promise<void> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    page.archive()
    await this.opts.pageRepository.save(page)
  }

  public async restorePage(
    ability: AnyAbility,
    pageId: string,
    editorId: string,
    userLevel: number,
  ): Promise<void> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    page.restore()
    await this.opts.pageRepository.save(page)
  }

  public async deletePage(
    ability: AnyAbility,
    pageId: string,
    editorId: string,
    userLevel: number,
  ): Promise<void> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    page.delete()
    await this.opts.pageRepository.save(page)
  }

  public async restorePageHistory(
    ability: AnyAbility,
    historyId: string,
    editorId: string,
    userLevel: number,
  ): Promise<void> {
    const history = await prisma.wikiPageHistory.findUnique({ where: { id: historyId } })
    if (!history) throw new Error('ERR_WIKI_PAGE_HISTORY_NOT_FOUND')

    const page = await this.opts.pageRepository.findById(history.pageId)
    if (!page) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(page.wikiId, editorId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    await prisma.wikiPageHistory.create({
      data: {
        id: uuidv4(),
        pageId: page.id,
        content: page.content,
        editorId: page.lastEditorId || page.authorId,
        editNote: 'Before restoring version',
      },
    })

    page.updateContent(page.title, history.content, page.slug, editorId)
    await this.opts.pageRepository.save(page)
  }

  public async getPageHistory(
    ability: AnyAbility,
    wikiId: string,
    pageId: string,
    userId: string,
    userLevel: number,
  ): Promise<any[]> {
    const page = await this.opts.pageRepository.findById(pageId)
    if (!page || page.wikiId !== wikiId) throw new Error('ERR_WIKI_PAGE_NOT_FOUND')

    const hasPermission = await this.checkEditPermission(wikiId, userId, userLevel, ability)
    if (!hasPermission) throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')

    return prisma.wikiPageHistory.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
      include: { editor: { select: { id: true, username: true } } },
    })
  }

  private async checkEditPermission(
    wikiId: string,
    userId: string,
    userLevel: number,
    ability: AnyAbility,
  ): Promise<boolean> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) return false

    if (wiki.ownerId === userId) return true

    const collaborator = await this.opts.collaboratorRepository.findByWikiAndUser(wikiId, userId)
    if (collaborator && (collaborator.role === CollaboratorRole.EDIT || collaborator.role === CollaboratorRole.ADMIN)) {
      return true
    }

    if (
      wiki.minEditLevel >= MIN_PUBLIC_EDIT_LEVEL &&
      wiki.minEditLevel < COLLABORATOR_ONLY_EDIT_LEVEL &&
      userLevel >= wiki.minEditLevel
    ) {
      return true
    }

    const wikiSubject = subject('Wiki', {
      id: wiki.id,
      ownerId: wiki.ownerId,
    })
    return ability.can('update', wikiSubject) || ability.can('manage', wikiSubject)
  }
}
