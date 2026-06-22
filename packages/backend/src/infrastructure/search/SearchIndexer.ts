import { prisma } from '../../db';
import { createWorker, getIndexQueue, SEARCH_INDEX_QUEUE_NAME } from '../queues/queueFactory';
import { PostStatus, UserStatus } from '@myndbbs/shared';

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700';
const MEILISEARCH_KEY = process.env.MEILISEARCH_KEY || '';
const POSTS_INDEX = 'posts';
const USERS_INDEX = 'users';

export interface PostDocument {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  categoryId: string | null;
  categoryName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  commentCount: number;
  upvoteCount: number;
  indexedAt: string;
}

export interface UserDocument {
  id: string;
  username: string;
  status: string;
  level: number;
  createdAt: Date;
  indexedAt?: string;
}

type MeiliSearchClient = {
  createIndex(uid: string, options?: { primaryKey?: string }): Promise<unknown>;
  index(uid: string): {
    updateFilterableAttributes(attrs: string[]): Promise<unknown>;
    updateSearchableAttributes(attrs: string[]): Promise<unknown>;
    updateSortableAttributes(attrs: string[]): Promise<unknown>;
    updateRankingRules(rules: string[]): Promise<unknown>;
    updatePagination(settings: { maxTotalHits: number }): Promise<unknown>;
    addDocuments(docs: unknown[], options?: { primaryKey?: string }): Promise<unknown>;
    deleteDocument(id: string): Promise<unknown>;
    search(query: string, params?: Record<string, unknown>): Promise<{ hits: unknown[] }>;
  };
};

type MeiliSearchConstructor = new (opts: { host: string; apiKey: string }) => MeiliSearchClient;

let client: MeiliSearchClient | null = null;

function getClient(): MeiliSearchClient | null {
  if (!process.env.MEILISEARCH_HOST && !process.env.MEILISEARCH_KEY) {
    return null;
  }
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const meilisearchModule = require('meilisearch') as {
      MeiliSearch?: MeiliSearchConstructor;
      Meilisearch?: MeiliSearchConstructor;
      default?: MeiliSearchConstructor;
    };
    const MeiliSearch = meilisearchModule.MeiliSearch ?? meilisearchModule.Meilisearch ?? meilisearchModule.default;
    if (!MeiliSearch) {
      throw new Error('ERR_MEILISEARCH_CLIENT_UNAVAILABLE');
    }
    client = new MeiliSearch({ host: MEILISEARCH_HOST, apiKey: MEILISEARCH_KEY });
  }
  return client;
}

async function ensureIndexes(): Promise<void> {
  const c = getClient();
  if (!c) return;

  try {
    await c.createIndex(POSTS_INDEX, { primaryKey: 'id' });
  } catch {
    // Index already exists
  }

  try {
    await c.createIndex(USERS_INDEX, { primaryKey: 'id' });
  } catch {
    // Index already exists
  }

  await c.index(POSTS_INDEX).updateFilterableAttributes(['status', 'categoryId', 'authorId']);
  await c.index(POSTS_INDEX).updateSearchableAttributes(['title', 'content', 'authorName', 'categoryName']);
  await c.index(POSTS_INDEX).updateSortableAttributes(['createdAt', 'updatedAt', 'upvoteCount', 'commentCount']);
  await c.index(POSTS_INDEX).updateRankingRules([
    'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
  ]);
  await c.index(POSTS_INDEX).updatePagination({ maxTotalHits: 10000 });
  await c.index(USERS_INDEX).updateFilterableAttributes(['status']);
  await c.index(USERS_INDEX).updateSearchableAttributes(['username']);
  await c.index(USERS_INDEX).updateSortableAttributes(['createdAt']);
}

export async function indexPost(post: PostDocument): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.index(POSTS_INDEX).addDocuments([post], { primaryKey: 'id' });
}

export async function indexUser(user: UserDocument): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.index(USERS_INDEX).addDocuments([user], { primaryKey: 'id' });
}

export async function deletePostFromIndex(postId: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.index(POSTS_INDEX).deleteDocument(postId);
}

export async function deleteUserFromIndex(userId: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.index(USERS_INDEX).deleteDocument(userId);
}

export async function searchPosts(
  query: string,
  limit: number = 20,
  offset: number = 0,
  filters?: string,
  highlightAttributes?: string[],
): Promise<unknown[]> {
  const c = getClient();
  if (!c) return [];

  const results = await c.index(POSTS_INDEX).search(query, {
    limit,
    offset,
    filter: filters,
    attributesToHighlight: highlightAttributes,
  });

  return results.hits;
}

export async function searchUsers(
  query: string,
  limit: number = 20,
  offset: number = 0,
  filters?: string,
  highlightAttributes?: string[],
): Promise<unknown[]> {
  const c = getClient();
  if (!c) return [];

  const results = await c.index(USERS_INDEX).search(query, {
    limit,
    offset,
    filter: filters,
    attributesToHighlight: highlightAttributes,
  });

  return results.hits;
}

export function isMeilisearchAvailable(): boolean {
  return getClient() !== null;
}

export async function bootstrapSearchIndexer(): Promise<void> {
  const c = getClient();
  if (!c) return;

  await ensureIndexes();

  const worker = createWorker(SEARCH_INDEX_QUEUE_NAME, async (job) => {
    const { type, data } = job.data as { type: string; data: unknown };

    switch (type) {
      case 'index-post':
        await indexPost(data as Parameters<typeof indexPost>[0]);
        break;
      case 'index-user':
        await indexUser(data as Parameters<typeof indexUser>[0]);
        break;
      case 'delete-post':
        await deletePostFromIndex(data as string);
        break;
      case 'delete-user':
        await deleteUserFromIndex(data as string);
        break;
      case 'reindex-all':
        await reindexAll();
        break;
    }
  }, {
    concurrency: 3,
    limiter: { max: 100, duration: 60000 },
  });

  worker.on('failed', (_job: unknown, err: Error) => {
    console.error('[SearchIndexer] Job failed:', err);
  });
}

async function reindexAll(): Promise<void> {
  const c = getClient();
  if (!c) return;

  const posts = await prisma.post.findMany({
    where: { status: { in: [PostStatus.PUBLISHED, PostStatus.PINNED] } },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, username: true } },
      category: { select: { id: true, name: true } },
      _count: { select: { comments: true, upvotes: true } },
    },
  });

  const postDocs = posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    authorId: p.author.id,
    authorName: p.author.username,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? '',
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    commentCount: p._count.comments,
    upvoteCount: p._count.upvotes,
    indexedAt: new Date().toISOString(),
  }));
  if (postDocs.length > 0) {
    await c.index(POSTS_INDEX).addDocuments(postDocs, { primaryKey: 'id' });
  }

  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE },
    select: {
      id: true,
      username: true,
      status: true,
      level: true,
      createdAt: true,
    },
  });

  const userDocs = users.map((u) => ({
    ...u,
    indexedAt: new Date().toISOString(),
  }));
  if (userDocs.length > 0) {
    await c.index(USERS_INDEX).addDocuments(userDocs, { primaryKey: 'id' });
  }
}

export function enqueueIndexJob(type: string, data: unknown): void {
  if (!process.env.MEILISEARCH_HOST && !process.env.MEILISEARCH_KEY) return;
  getIndexQueue().add(type, { type, data }).catch((err: unknown) => {
    console.error('[SearchIndexer] Failed to enqueue job:', err);
  });
}
