import type { MetadataRoute } from 'next';

/**
 * 动态 sitemap：静态页 + 公开分类 + 最近帖子。
 * 数据来自后端公开 API（游客可读），失败时仅输出静态路由。
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kolobbs.kolostudio.fun';
const BACKEND = process.env.API_URL || 'http://127.0.0.1:3001';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

interface SitemapPost {
  id: string;
  updatedAt: string;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/recent`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/tags`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/register`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ];

  const categories = await fetchJson<Array<{ name: string }>>('/api/categories');
  const categoryEntries: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
    url: `${SITE_URL}/c/${encodeURIComponent(c.name)}`,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  const postsData = await fetchJson<SitemapPost[] | { posts?: SitemapPost[] }>('/api/posts?take=1000');
  const posts = Array.isArray(postsData) ? postsData : postsData?.posts ?? [];
  const postEntries: MetadataRoute.Sitemap = posts.slice(0, 1000).map((p) => ({
    url: `${SITE_URL}/p/${p.id}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticEntries, ...categoryEntries, ...postEntries];
}
