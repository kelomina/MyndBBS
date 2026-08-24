/**
 * 值对象工具：话题标签名称规范化与上限常量。
 *
 * 规范化规则：
 *   - 去除首尾空白与前导 #
 *   - 折叠连续空白为单个空格，转小写（中文不受影响）
 *   - 长度 1-32，字符集限字母/数字/下划线/连字符/空格/中日韩文字
 */
export const MAX_TAGS_PER_POST = 5;
export const MAX_TAG_NAME_LENGTH = 32;

const TAG_NAME_REGEX = /^[\p{L}\p{N}_\- ]+$/u;

export function normalizeTagName(input: string): string | null {
  const normalized = input
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!normalized || normalized.length > MAX_TAG_NAME_LENGTH) return null;
  if (!TAG_NAME_REGEX.test(normalized)) return null;
  return normalized;
}

/** 批量规范化并去重，保持输入顺序；非法项静默丢弃；超出上限截断 */
export function normalizeTagNames(inputs: string[]): string[] {
  const seen = new Set<string>();
  for (const input of inputs) {
    const name = normalizeTagName(input);
    if (name && !seen.has(name)) seen.add(name);
    if (seen.size >= MAX_TAGS_PER_POST) break;
  }
  return [...seen];
}
