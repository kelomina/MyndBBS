'use client';

import { useState } from 'react';
import { ArrowBigUp, Bookmark, Share, MessageSquare } from 'lucide-react';

export function CommentItem({ 
  comment, 
  dict, 
  onReply 
}: { 
  comment: any; 
  dict: any; 
  onReply: (parentId: string) => void;
}) {
  const [upvotes, setUpvotes] = useState(comment._count?.upvotes || 0);
  const [hasUpvoted, setHasUpvoted] = useState(comment.hasUpvoted || false);
  const [hasBookmarked, setHasBookmarked] = useState(comment.hasBookmarked || false);
  const [loadingUpvote, setLoadingUpvote] = useState(false);
  const [loadingBookmark, setLoadingBookmark] = useState(false);

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
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
            {comment.content}
          </p>
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
          </div>
        </div>
      </div>
    </div>
  );
}