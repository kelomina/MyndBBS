import { randomUUID as uuidv4 } from 'crypto'
import { AnyAbility, subject } from '@casl/ability'
import { IWikiRepository } from '../../domain/wiki/IWikiRepository'
import { IWikiCollaboratorRepository } from '../../domain/wiki/IWikiCollaboratorRepository'
import { Wiki } from '../../domain/wiki/Wiki'
import { WikiCollaborator } from '../../domain/wiki/WikiCollaborator'
import { CollaboratorRole } from '../../domain/wiki/WikiCollaborator'
import { prisma } from '../../db'

export const COLLABORATOR_ONLY_EDIT_LEVEL = 999
export const MIN_PUBLIC_EDIT_LEVEL = 2

export interface WikiApplicationServiceOptions {
  wikiRepository: IWikiRepository
  collaboratorRepository: IWikiCollaboratorRepository
}
export class WikiApplicationService {
  constructor(private readonly opts: WikiApplicationServiceOptions) {}

  private checkCanCreateWiki(userLevel: number): boolean {
    return userLevel >= 2
  }

  private async getWikiCreationCountIn7Days(userId: string): Promise<number> {
    const limit = await prisma.wikiCreationLimit.findUnique({ where: { userId } })
    if (!limit) return 0

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const creationTimes = limit.creationTimes as string[]
    return creationTimes.filter(time => new Date(time) > sevenDaysAgo).length
  }

  private async recordWikiCreation(userId: string): Promise<void> {
    const existing = await prisma.wikiCreationLimit.findUnique({ where: { userId } })
    if (existing) {
      const times = (existing.creationTimes as string[]) || []
      times.push(new Date().toISOString())
      await prisma.wikiCreationLimit.update({
        where: { userId },
        data: { creationTimes: times },
      })
    } else {
      await prisma.wikiCreationLimit.create({
        data: {
          id: uuidv4(),
          userId,
          creationTimes: [new Date().toISOString()],
        },
      })
    }
  }

  public async createWiki(
    title: string,
    description: string,
    coverUrl: string | null,
    ownerId: string,
    userLevel: number,
  ): Promise<Wiki> {
    if (!this.checkCanCreateWiki(userLevel)) {
      throw new Error('ERR_INSUFFICIENT_LEVEL_TO_CREATE_WIKI')
    }

    const creationCount = await this.getWikiCreationCountIn7Days(ownerId)
    const limit = userLevel >= 6 ? 3 : userLevel >= 4 ? 2 : 1
    if (creationCount >= limit) {
      throw new Error('ERR_WIKI_CREATION_LIMIT_EXCEEDED')
    }

    const wiki = Wiki.create({
      id: uuidv4(),
      title,
      description,
      coverUrl,
      ownerId,
      minReadLevel: 0,
      minEditLevel: COLLABORATOR_ONLY_EDIT_LEVEL,
      isPublic: true,
    })

    await this.opts.wikiRepository.save(wiki)
    await this.recordWikiCreation(ownerId)
    return wiki
  }

  public async updateWiki(
    ability: AnyAbility,
    wikiId: string,
    title: string,
    description: string,
    coverUrl: string | null,
  ): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('update', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    wiki.updateDetails(title, description, coverUrl)
    await this.opts.wikiRepository.save(wiki)
  }

  public async updateWikiPermissions(
    ability: AnyAbility,
    wikiId: string,
    minReadLevel: number,
    minEditLevel: number,
    isPublic: boolean,
  ): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('manage', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    wiki.updatePermissions(minReadLevel, minEditLevel, isPublic)
    await this.opts.wikiRepository.save(wiki)
  }

  public async archiveWiki(ability: AnyAbility, wikiId: string): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('manage', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    wiki.archive()
    await this.opts.wikiRepository.save(wiki)
  }

  public async restoreWiki(ability: AnyAbility, wikiId: string): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('manage', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    wiki.restore()
    await this.opts.wikiRepository.save(wiki)
  }

  public async deleteWiki(ability: AnyAbility, wikiId: string): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('delete', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    wiki.delete()
    await this.opts.wikiRepository.save(wiki)
  }

  public async addCollaborator(
    ability: AnyAbility,
    wikiId: string,
    userId: string,
    role: CollaboratorRole,
  ): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('manage', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    const existing = await this.opts.collaboratorRepository.findByWikiAndUser(wikiId, userId)
    if (existing) throw new Error('ERR_COLLABORATOR_ALREADY_EXISTS')

    const collaborator = WikiCollaborator.create({
      id: uuidv4(),
      wikiId,
      userId,
      role,
    })

    await this.opts.collaboratorRepository.save(collaborator)
  }

  public async updateCollaboratorRole(
    ability: AnyAbility,
    wikiId: string,
    userId: string,
    role: CollaboratorRole,
  ): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('manage', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    const collaborator = await this.opts.collaboratorRepository.findByWikiAndUser(wikiId, userId)
    if (!collaborator) throw new Error('ERR_COLLABORATOR_NOT_FOUND')

    collaborator.updateRole(role)
    await this.opts.collaboratorRepository.save(collaborator)
  }

  public async removeCollaborator(
    ability: AnyAbility,
    wikiId: string,
    userId: string,
  ): Promise<void> {
    const wiki = await this.opts.wikiRepository.findById(wikiId)
    if (!wiki) throw new Error('ERR_WIKI_NOT_FOUND')

    const wikiSubject = this.getWikiSubject(wiki)
    if (!ability.can('manage', wikiSubject)) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS')
    }

    await this.opts.collaboratorRepository.delete(wikiId, userId)
  }

  private getWikiSubject(wiki: Wiki): any {
    return subject('Wiki', {
      id: wiki.id,
      title: wiki.title,
      ownerId: wiki.ownerId,
      minReadLevel: wiki.minReadLevel,
      minEditLevel: wiki.minEditLevel,
      isPublic: wiki.isPublic,
      status: wiki.status,
    })
  }
}
