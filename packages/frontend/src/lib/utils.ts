import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCategoryTranslation(name: string | undefined | null, dict: any): string {
  if (!name) return dict?.profile?.uncategorized || 'Uncategorized';
  const key = `category${name.charAt(0).toUpperCase() + name.slice(1)}`;
  return dict?.common?.[key] || name;
}

export type PostListEmptyKind = 'general' | 'category' | 'recent' | 'popular';

export function getPostListEmptyMessage(kind: PostListEmptyKind, dict: any): string {
  if (kind === 'recent') return dict?.category?.noRecentPostsFound || dict?.category?.noPostsFoundGeneral || 'No posts found.';
  if (kind === 'popular') return dict?.category?.noPopularPostsFound || dict?.category?.noPostsFoundGeneral || 'No posts found.';
  if (kind === 'category') return dict?.category?.noPostsFound || dict?.category?.noPostsFoundGeneral || 'No posts found.';
  return dict?.category?.noPostsFoundGeneral || 'No posts found.';
}
