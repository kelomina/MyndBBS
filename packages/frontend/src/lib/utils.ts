import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Dictionary } from '../types';

/**
 * Callers: []
 * Callees: [twMerge, clsx]
 * Description: Handles the cn logic for the application.
 * Keywords: cn, auto-annotated
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Callers: []
 * Callees: [toUpperCase, charAt, slice]
 * Description: Handles the get category translation logic for the application.
 * Keywords: getcategorytranslation, get, category, translation, auto-annotated
 */
export function getCategoryTranslation(name: string | undefined | null, dict: Dictionary): string {
  if (!name) return dict?.profile?.uncategorized || 'Uncategorized';
  const key = `category${name.charAt(0).toUpperCase() + name.slice(1)}`;
  const common = dict.common as unknown as Record<string, string | undefined>;
  return common[key] || name;
}

export type PostListEmptyKind = 'general' | 'category' | 'recent' | 'popular';

/**
 * Callers: []
 * Callees: []
 * Description: Handles the get post list empty message logic for the application.
 * Keywords: getpostlistemptymessage, get, post, list, empty, message, auto-annotated
 */
export function getPostListEmptyMessage(kind: PostListEmptyKind, dict: Dictionary): string {
  if (kind === 'recent') return dict?.category?.noRecentPostsFound || dict?.category?.noPostsFoundGeneral || 'No posts found.';
  if (kind === 'popular') return dict?.category?.noPopularPostsFound || dict?.category?.noPostsFoundGeneral || 'No posts found.';
  if (kind === 'category') return dict?.category?.noPostsFound || dict?.category?.noPostsFoundGeneral || 'No posts found.';
  return dict?.category?.noPostsFoundGeneral || 'No posts found.';
}
