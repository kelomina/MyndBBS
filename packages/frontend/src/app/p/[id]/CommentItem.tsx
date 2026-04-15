'use client';
import { useToast } from '../../../components/ui/Toast';

import { useState } from 'react';
import { fetcher } from '../../../lib/api/fetcher';
import { ArrowBigUp, Bookmark, Share, MessageSquare, Trash2, Edit2, X, Check } from 'lucide-react';
import type { Dictionary } from '../../../i18n/types';

type CommentAuthor = { username?: string | null };
type Comment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  hasUpvoted?: boolean;
  hasBookmarked?: boolean;
  _count?: { upvotes?: number };
  author?: CommentAuthor | null;
};
type CurrentUser = { username: string; role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' };

/**
 * Callers: []
 * Callees: [useToast, useState, setLoadingUpvote, fetcher, setHasUpvoted, setUpvotes, error, includes, toast, setLoadingBookmark, setHasBookmarked, share, toString, writeText, trim, setIsUpdating, stringify, setIsEditing, setContent, setUpdatedAt, toUpperCase, toLocaleString, getTime, setEditContent, onReply]
 * Description: Handles the comment item logic for the application.
 * Keywords: commentitem, comment, item, auto-annotated
 */
export function CommentItem({ 
  comment, 
  dict, 
  onReply,
  onDelete,
  currentUser
}: { 
  comment: Comment; 
  dict: Dictionary; 
  onReply: (parentId: string) => void;
  onDelete?: () => void;
  currentUser?: CurrentUser | null;
}) {
  const { toast } = useToast();
  const [upvotes, setUpvotes] = useState(comment._count?.upvotes || 0);
  const [hasUpvoted, setHasUpvoted] = useState(comment.hasUpvoted || false);
  const [hasBookmarked, setHasBookmarked] = useState(comment.hasBookmarked || false);
  const [loadingUpvote, setLoadingUpvote] = useState(false);
  const [loadingBookmark, setLoadingBookmark] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [content, setContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(comment.updatedAt);

  /**
     * Callers: []
     * Callees: [setLoadingUpvote, fetcher, setHasUpvoted, setUpvotes, error, includes, toast]
     * Description: Handles the handle upvote logic for the application.
     * Keywords: handleupvote, handle, upvote, auto-annotated
     */
    const handleUpvote = async () => {
    if (loadingUpvote) return;
    setLoadingUpvote(true);
    try {
      const data = await fetcher(`/api/posts/comments/${comment.id}/upvote`, { method: 'POST' });
      setHasUpvoted(data.upvoted);
      setUpvotes((prev: number) => data.upvoted ? prev + 1 : prev - 1);
    } catch (error: unknown) {
      console.error('Upvote failed:', error);
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('UNAUTHORIZED') || msg.includes('login') || msg.includes('401')) {
        toast(dict.auth?.pleaseLogin || 'Please login to upvote.', 'error');
      }
    } finally {
      setLoadingUpvote(false);
    }
  };

  /**
     * Callers: []
     * Callees: [setLoadingBookmark, fetcher, setHasBookmarked, error, includes, toast]
     * Description: Handles the handle bookmark logic for the application.
     * Keywords: handlebookmark, handle, bookmark, auto-annotated
     */
    const handleBookmark = async () => {
    if (loadingBookmark) return;
    setLoadingBookmark(true);
    try {
      const data = await fetcher(`/api/posts/comments/${comment.id}/bookmark`, { method: 'POST' });
      setHasBookmarked(data.bookmarked);
    } catch (error: unknown) {
      console.error('Bookmark failed:', error);
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('UNAUTHORIZED') || msg.includes('login') || msg.includes('401')) {
        toast(dict.auth?.pleaseLogin || 'Please login to bookmark.', 'error');
      }
    } finally {
      setLoadingBookmark(false);
    }
  };

  /**
     * Callers: []
     * Callees: [share, toString, writeText, toast]
     * Description: Handles the handle share logic for the application.
     * Keywords: handleshare, handle, share, auto-annotated
     */
    const handleShare = () => {
    const url = new URL(window.location.href);
    url.hash = `comment-${comment.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Comment by ${comment.author?.username}`,
        url: url.toString()
      });
    } else {
      navigator.clipboard.writeText(url.toString());
      toast(dict.common?.linkCopied || 'Comment link copied to clipboard!', 'success');
    }
  };

  /**
     * Callers: []
     * Callees: [trim, setIsUpdating, fetcher, stringify, toast, setIsEditing, setContent, setUpdatedAt, error]
     * Description: Handles the handle edit submit logic for the application.
     * Keywords: handleeditsubmit, handle, edit, submit, auto-annotated
     */
    const handleEditSubmit = async () => {
    if (!editContent.trim() || isUpdating) return;
    setIsUpdating(true);
    try {
      const data = await fetcher(`/api/posts/comments/${comment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent })
      });
      
      if (data.message === 'ERR_PENDING_MODERATION') {
        toast(dict.apiErrors?.ERR_PENDING_MODERATION || "Your content contains moderated words and has been submitted for manual review.", 'info');
        setIsEditing(false);
        setContent(editContent);
        return;
      }
      
      setContent(data.content);
      setUpdatedAt(data.updatedAt);
      setIsEditing(false);
    } catch (error: unknown) {
      console.error('Update failed:', error);
      const msg = error instanceof Error ? error.message : 'Failed to update comment';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg || apiErrors?.ERR_FAILED_TO_UPDATE_COMMENT || 'Failed to update comment', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const canDelete = currentUser && (
    currentUser.username === comment.author?.username ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'MODERATOR'
  );

  const isDeleted = comment.deletedAt != null;

  if (isDeleted) {
    return (
      <div id={`comment-${comment.id}`} className="rounded-xl bg-muted/30 p-5 shadow-sm border border-border/50 opacity-70">
        <div className="flex flex-col py-2 text-muted">
          <p className="text-sm font-medium">{dict.profile?.commentDeleted || 'This comment has been deleted.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div id={`comment-${comment.id}`} className="rounded-xl bg-card p-5 shadow-sm border border-border/50">
      <div className="flex space-x-3">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
          {comment.author?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline space-x-2">
            <span className="font-medium text-foreground text-sm">{comment.author?.username || 'Unknown'}</span>
            <span className="text-xs text-muted">
              {new Date(comment.createdAt).toLocaleString()}
              {updatedAt && new Date(updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000 && (
                <span className="ml-2 italic">({dict.post?.edited || 'Edited'}: {new Date(updatedAt).toLocaleString()})</span>
              )}
            </span>
          </div>
          
          {isEditing ? (
            <div className="mt-2 flex flex-col space-y-2">
              <textarea 
                className="w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={isUpdating}
              />
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(content);
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium text-muted hover:bg-muted/20"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button 
                  onClick={handleEditSubmit}
                  disabled={isUpdating || !editContent.trim() || editContent === content}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {content}
            </p>
          )}

          <div className="mt-3 flex items-center space-x-4 text-xs text-muted font-medium">
            <button 
              onClick={handleUpvote}
              disabled={loadingUpvote}
              className={`flex items-center gap-1 transition-colors hover:text-primary ${hasUpvoted ? 'text-primary' : ''}`}
            >
              <ArrowBigUp className="h-4 w-4" /> {upvotes}
            </button>
            <button 
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 transition-colors hover:text-primary"
            >
              <MessageSquare className="h-4 w-4" /> {dict.post?.reply || 'Reply'} {comment._count?.replies > 0 ? `(${comment._count.replies})` : ''}
            </button>
            <button 
              onClick={handleBookmark}
              disabled={loadingBookmark}
              className={`flex items-center gap-1 transition-colors hover:text-primary ${hasBookmarked ? 'text-primary fill-primary' : ''}`}
            >
              <Bookmark className="h-4 w-4" /> {dict.profile?.bookmarks || 'Bookmark'}
            </button>
            <button 
              onClick={handleShare}
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <Share className="h-4 w-4" /> {dict.post?.share || 'Share'}
            </button>
            {canDelete && (
              <>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1 transition-colors hover:text-primary"
                  title={dict.post?.editComment || "Edit Comment"}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={onDelete}
                  className="flex items-center gap-1 transition-colors hover:text-red-500"
                  title={dict.post?.deleteComment || "Delete Comment"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
