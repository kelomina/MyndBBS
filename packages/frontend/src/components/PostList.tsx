import Link from 'next/link';
import { MessageSquare, ArrowBigUp } from 'lucide-react';
import { getCategoryTranslation } from '../lib/utils';
import { Avatar } from './Avatar';
import type { Dictionary, PostListPost } from '../types';

interface PostListProps {
  posts: PostListPost[];
  emptyMessage?: string;
  dict: Dictionary;
}

/**
 * Callers: []
 * Callees: [map, toUpperCase, toLocaleDateString, getCategoryTranslation, replace]
 * Description: Handles the post list logic for the application. Truncates and cleans markdown content for preview.
 * Keywords: postlist, post, list, markdown
 */
export function PostList({ posts, emptyMessage = "No posts found.", dict }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center text-muted py-10">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <article key={post.id} className="rounded-xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md border border-border/50">
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <div className="flex items-center space-x-2">
              <Link href={`/u/${post.author?.username}`} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Avatar src={post.author?.avatarUrl} username={post.author?.username || 'U'} size={24} />
                <span className="font-medium text-foreground">{post.author?.username || 'Unknown'}</span>
              </Link>
              <span>•</span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <span className="rounded-full bg-background px-2.5 py-0.5 font-medium">
              {getCategoryTranslation(post.category?.name, dict)}
            </span>
          </div>
          
          <h2 className="mb-2 text-xl font-bold text-foreground transition-colors hover:text-primary cursor-pointer">
            <Link href={`/p/${post.id}`}>{stripHighlightTags(post.highlight?.title) || post.title}</Link>
          </h2>
          <p className="mb-4 text-sm text-muted line-clamp-2">
            {(stripHighlightTags(post.highlight?.content) || post.content).replace(/[#*_~`\[\]]/g, '')}
          </p>
          
          <div className="flex items-center space-x-4 text-sm font-medium text-muted">
            <button className="flex items-center space-x-1 transition-colors hover:text-primary">
              <ArrowBigUp className="h-5 w-5" />
              <span>{post._count?.upvotes || 0}</span>
            </button>
            <button className="flex items-center space-x-1 transition-colors hover:text-primary">
              <MessageSquare className="h-4 w-4" />
              <span>{post._count?.comments || 0}</span>
            </button>
          </div>
        </article>
      ))}
    </>
  );
}

function stripHighlightTags(value?: string): string {
  return value?.replace(/<\/?em>/g, '') ?? '';
}
