'use client';
import { useToast } from '../../../components/ui/Toast';
import { useTranslation } from '../../../components/TranslationProvider';

import { useState, useEffect } from 'react';
import { ArrowBigUp, Bookmark, Share, Trash2, Edit2 } from 'lucide-react';
import { useCurrentUser } from '../../../lib/hooks';
import { useRouter } from 'next/navigation';

/**
 * Callers: []
 * Callees: [useToast, useTranslation, useState, useCurrentUser, useRouter, useEffect, fetch, json, setHasUpvoted, setHasBookmarked, error, checkInteractions, setLoading, setUpvotes, toast, share, writeText, confirm, push]
 * Description: Handles the post actions logic for the application.
 * Keywords: postactions, post, actions, auto-annotated
 */
export function PostActions({ 
  postId, 
  initialUpvotes, 
  initialBookmarks,
  authorUsername
}: { 
  postId: string, 
  initialUpvotes: number, 
  initialBookmarks: number,
  authorUsername: string
}) {
  const { toast } = useToast();
  const dict = useTranslation();
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    
    // Check initial interaction status
    /**
       * Callers: []
       * Callees: [fetch, json, setHasUpvoted, setHasBookmarked, error]
       * Description: Handles the check interactions logic for the application.
       * Keywords: checkinteractions, check, interactions, auto-annotated
       */
      const checkInteractions = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${postId}/interactions`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setHasUpvoted(data.upvoted);
          setHasBookmarked(data.bookmarked);
        }
      } catch (error) {
        console.error('Failed to load interactions status:', error);
      }
    };
    checkInteractions();
  }, [postId]);

  /**
     * Callers: []
     * Callees: [setLoading, fetch, json, setHasUpvoted, setUpvotes, toast, error]
     * Description: Handles the handle upvote logic for the application.
     * Keywords: handleupvote, handle, upvote, auto-annotated
     */
    const handleUpvote = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${postId}/upvote`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHasUpvoted(data.upvoted);
        setUpvotes(prev => data.upvoted ? prev + 1 : prev - 1);
      } else {
        if (res.status === 401) toast(dict.auth?.pleaseLogin || 'Please login to upvote.', 'error');
      }
    } catch (error) {
      console.error('Upvote failed:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
     * Callers: []
     * Callees: [setLoading, fetch, json, setHasBookmarked, toast, error]
     * Description: Handles the handle bookmark logic for the application.
     * Keywords: handlebookmark, handle, bookmark, auto-annotated
     */
    const handleBookmark = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${postId}/bookmark`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHasBookmarked(data.bookmarked);
      } else {
        if (res.status === 401) toast(dict.auth?.pleaseLogin || 'Please login to bookmark.', 'error');
      }
    } catch (error) {
      console.error('Bookmark failed:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
     * Callers: []
     * Callees: [share, writeText, toast]
     * Description: Handles the handle share logic for the application.
     * Keywords: handleshare, handle, share, auto-annotated
     */
    const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: document.title,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast(dict.common?.linkCopied || 'Link copied to clipboard!', 'success');
    }
  };

  /**
     * Callers: []
     * Callees: [confirm, setLoading, fetch, toast, push, json, error]
     * Description: Handles the handle delete logic for the application.
     * Keywords: handledelete, handle, delete, auto-annotated
     */
    const handleDelete = async () => {
    if (!confirm(dict.post?.confirmDeletePost || 'Are you sure you want to delete this post?')) return;
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast(dict.post?.postDeleted || 'Post deleted successfully', 'success');
        router.push('/');
      } else {
        const data = await res.json();
        toast(data.error || dict.apiErrors?.ERR_FAILED_TO_DELETE || 'Failed to delete post', 'error');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast(dict.apiErrors?.ERR_FAILED_TO_DELETE || 'Failed to delete post', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canDelete = currentUser && (
    currentUser.username === authorUsername ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'MODERATOR'
  );

  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <div className="flex items-center space-x-6 text-muted">
        <button 
          onClick={handleUpvote}
          disabled={loading}
          className={`flex items-center space-x-2 transition-colors hover:text-primary ${hasUpvoted ? 'text-primary' : ''}`}
        >
          <ArrowBigUp className="h-6 w-6" />
          <span className="font-medium">{upvotes}</span>
        </button>
      </div>
      <div className="flex items-center space-x-4 text-muted">
        <button 
          onClick={handleBookmark}
          disabled={loading}
          className={`transition-colors hover:text-primary ${hasBookmarked ? 'text-primary fill-primary' : ''}`}
        >
          <Bookmark className="h-5 w-5" />
        </button>
        <button 
          onClick={handleShare}
          className="transition-colors hover:text-foreground"
        >
          <Share className="h-5 w-5" />
        </button>
        {canDelete && (
          <>
            <button 
              onClick={() => router.push(`/p/${postId}/edit`)}
              disabled={loading}
              className="transition-colors hover:text-primary"
              title={dict.post?.editPost || "Edit Post"}
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="transition-colors hover:text-red-500"
              title={dict.post?.deletePost || "Delete Post"}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
