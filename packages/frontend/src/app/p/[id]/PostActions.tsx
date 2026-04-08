'use client';

import { useState, useEffect } from 'react';
import { ArrowBigUp, Bookmark, Share } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PostActions({ 
  postId, 
  initialUpvotes, 
  initialBookmarks 
}: { 
  postId: string, 
  initialUpvotes: number, 
  initialBookmarks: number 
}) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check initial interaction status
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
        if (res.status === 401) alert('Please login to upvote.');
      }
    } catch (error) {
      console.error('Upvote failed:', error);
    } finally {
      setLoading(false);
    }
  };

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
        if (res.status === 401) alert('Please login to bookmark.');
      }
    } catch (error) {
      console.error('Bookmark failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: document.title,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

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
      </div>
    </div>
  );
}
