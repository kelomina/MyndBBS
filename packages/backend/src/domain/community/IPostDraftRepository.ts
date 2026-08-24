/**
 * 接口名称：IPostDraftRepository
 *
 * 函数作用：
 *   发帖草稿（每用户单槽）的读写接口。
 */
export interface PostDraftData {
  title: string;
  content: string;
  categoryId: string | null;
  updatedAt: Date;
}

export interface IPostDraftRepository {
  get(userId: string): Promise<PostDraftData | null>;

  upsert(userId: string, data: { title: string; content: string; categoryId?: string | null }): Promise<void>;

  clear(userId: string): Promise<boolean>;
}
