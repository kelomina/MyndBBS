/**
 * 数据：开放 API 文档（信息性文档，非机器契约）。
 * 约定：新增公开端点合入时同步更新本文件。
 */

export interface ApiDocParam {
  name: string;
  location: 'path' | 'query' | 'body';
  type: string;
  required?: boolean;
  description: string;
}

export interface ApiDocEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  auth: 'none' | 'session' | 'admin' | 'super-admin';
  summary: string;
  params?: ApiDocParam[];
}

export interface ApiDocGroup {
  group: string;
  endpoints: ApiDocEndpoint[];
}

export const OPEN_API_DOCS: ApiDocGroup[] = [
  {
    group: 'Categories',
    endpoints: [
      { method: 'GET', path: '/api/categories', auth: 'none', summary: 'List all forum categories with min-level gates.' },
    ],
  },
  {
    group: 'Tags',
    endpoints: [
      { method: 'GET', path: '/api/tags', auth: 'none', summary: 'All topic tags ordered by post count.' },
      { method: 'GET', path: '/api/posts?tag=<name>', auth: 'none', summary: 'Published posts carrying a given tag.', params: [{ name: 'tag', location: 'query', type: 'string', description: 'Tag name (case-insensitive).' }] },
    ],
  },
  {
    group: 'Posts',
    endpoints: [
      { method: 'GET', path: '/api/posts', auth: 'none', summary: 'Post list. Query: category, sortBy (recent|popular), tag, take (≤100).', params: [{ name: 'category', location: 'query', type: 'string', description: 'Category name filter.' }, { name: 'sortBy', location: 'query', type: '"recent"|"popular"', description: 'Sort order.' }, { name: 'take', location: 'query', type: 'number', description: 'Page size (default 20).' }] },
      { method: 'GET', path: '/api/posts/:id', auth: 'none', summary: 'Post detail incl. author badges and tags.' },
      { method: 'GET', path: '/api/posts/:id/comments', auth: 'none', summary: 'Paginated comment tree for a post.', params: [{ name: 'parentId', location: 'query', type: 'string', description: 'Fetch children of a comment.' }, { name: 'skip / take', location: 'query', type: 'number', description: 'Pagination window.' }] },
      { method: 'POST', path: '/api/posts', auth: 'session', summary: 'Create a post (captcha; anti-spam guard; optional tags array ≤5).', params: [{ name: 'title / content / categoryId / captchaId', location: 'body', type: 'string', required: true, description: 'Core fields.' }, { name: 'tags', location: 'body', type: 'string[]', description: 'Topic tags.' }] },
      { method: 'POST', path: '/api/posts/:id/comments', auth: 'session', summary: 'Comment on a post (mentions notify users).', params: [{ name: 'content / captchaId', location: 'body', type: 'string', required: true, description: 'Comment body and captcha.' }, { name: 'parentId', location: 'body', type: 'string', description: 'Parent comment for replies.' }] },
    ],
  },
  {
    group: 'Users',
    endpoints: [
      { method: 'GET', path: '/api/v1/user/public/:username', auth: 'none', summary: 'Public profile: avatar, bio, badges, join date, post count.' },
      { method: 'PUT', path: '/api/v1/user/bio', auth: 'session', summary: 'Update own bio (plain text ≤200 chars).', params: [{ name: 'bio', location: 'body', type: 'string|null', description: 'Empty string clears the bio.' }] },
      { method: 'PUT', path: '/api/v1/user/notification-preferences', auth: 'session', summary: 'Toggle email notifications for reply/mention events.', params: [{ name: 'enabled', location: 'body', type: 'boolean', required: true, description: 'Opt-in flag.' }] },
    ],
  },
  {
    group: 'Reports',
    endpoints: [
      { method: 'POST', path: '/api/v1/reports', auth: 'session', summary: 'Report a post or comment (deduped per reporter+target; rate limited 10/15min).', params: [{ name: 'targetType', location: 'body', type: '"POST"|"COMMENT"', required: true, description: 'Kind of content.' }, { name: 'postId / commentId', location: 'body', type: 'string', required: true, description: 'Target ids (comment reports also carry postId).' }, { name: 'reason', location: 'body', type: 'enum', required: true, description: 'SPAM|PORNOGRAPHY|ILLEGAL|ABUSE|COPYRIGHT|OTHER.' }, { name: 'detail', location: 'body', type: 'string', description: 'Required when reason=OTHER.' }] },
    ],
  },
  {
    group: 'Drafts',
    endpoints: [
      { method: 'GET', path: '/api/v1/drafts/post', auth: 'session', summary: 'Current user’s single autosave draft (null if none).' },
      { method: 'PUT', path: '/api/v1/drafts/post', auth: 'session', summary: 'Upsert the draft (title/content/categoryId).' },
      { method: 'DELETE', path: '/api/v1/drafts/post', auth: 'session', summary: 'Discard the draft after publishing.' },
    ],
  },
];
