/**
 * 接口名称：ISitePolicyRepository
 */
export interface ISitePolicyRepository {
  /** 读取指定 key 的策略值；不存在返回 null */
  get(key: string): Promise<unknown | null>;

  /** 写入或更新策略值 */
  set(key: string, value: unknown): Promise<void>;
}
