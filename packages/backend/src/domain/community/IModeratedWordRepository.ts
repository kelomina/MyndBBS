import { ModeratedWord } from './ModeratedWord';

/**
 * 接口名称：IModeratedWordRepository
 *
 * 函数作用：
 *   敏感词聚合的仓储接口。
 * Purpose:
 *   Repository interface for ModeratedWord aggregates.
 *
 * 中文关键词：
 *   敏感词，仓储接口
 * English keywords:
 *   moderated word, repository interface
 */
export interface IModeratedWordRepository {
  findById(id: string): Promise<ModeratedWord | null>;
  findAll(): Promise<ModeratedWord[]>;
  save(word: ModeratedWord): Promise<void>;
  delete(id: string): Promise<void>;
}
