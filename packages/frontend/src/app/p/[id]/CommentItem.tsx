'use client';

import { useState } from 'react';
import { ArrowBigUp, Bookmark, Share, MessageSquare, Trash2, Edit2, X, Check } from 'lucide-react';

export function CommentItem({ 
  comment, 
  dict, 
  onReply,
  onDelete,
  currentUser
}: { 
  comment: any; 
  dict: any; 
  onReply: (parentId: string) => void;
  onDelete?: () => void;
  currentUser?: any;
}) {
  const [upvotes, setUpvotes] = useState(comment._count?.upvotes || 0);
  const [hasUpvoted, setHasUpvoted] = useState(comment.hasUpvoted || false);
  const [hasBookmarked, setHasBookmarked] = useState(comment.hasBookmarked || false);
  const [loadingUpvote, setLoadingUpvote] = useState(false);
  const [loadingBookmark, setLoadingBookmark] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [content, setContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpvote = async () => {
    if (loadingUpvote) return;
    setLoadingUpvote(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/comments/${comment.id}/upvote`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHasUpvoted(data.upvoted);
        setUpvotes((prev: number) => data.upvoted ? prev + 1 : prev - 1);
      } else if (res.status === 401) {
        alert('Please login to upvote.');
      }
    } catch (error) {
      console.error('Upvote failed:', error);
    } finally {
      setLoadingUpvote(false);
    }
  };

  const handleBookmark = async () => {
    if (loadingBookmark) return;
    setLoadingBookmark(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/comments/${comment.id}/bookmark`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHasBookmarked(data.bookmarked);
      } else if (res.status === 401) {
        alert('Please login to bookmark.');
      }
    } catch (error) {
      console.error('Bookmark failed:', error);
    } finally {
      setLoadingBookmark(false);
    }
  };

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
      alert('Comment link copied to clipboard!');
    }
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim() || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setIsEditing(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update comment');
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert('Failed to update comment');
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
            <span className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString()}</span>
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
                  title="Edit Comment"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={onDelete}
                  className="flex items-center gap-1 transition-colors hover:text-red-500"
                  title="Delete Comment"
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