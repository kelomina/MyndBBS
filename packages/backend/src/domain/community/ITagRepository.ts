/**
 * 接口名称：ITagRepository / IPostTagRepository
 *
 * 函数作用：
 *   话题标签聚合的读写接口：标签的查建合一（ensure）与帖子-标签关联集合替换。
 */
export interface TagWithCount {
  name: string;
  postCount: number;
}

export interface ITagRepository {
  findByName(name: string): Promise<{ id: string; name: string } | null>;

  /** 按名称查找，不存在则创建；返回 id */
  ensure(name: string): Promise<{ id: string; name: string }>;

  /** 全部标签按帖子数降序 */
  listWithCounts(limit?: number): Promise<TagWithCount[]>;
}

export interface IPostTagRepository {
  /** 帖子当前标签名列表 */
  getTagNamesForPost(postId: string): Promise<string[]>;

  /** 用给定标签 ID 集合整体替换帖子的标签关联 */
  setTagsForPost(postId: string, tagIds: string[]): Promise<void>;
}
