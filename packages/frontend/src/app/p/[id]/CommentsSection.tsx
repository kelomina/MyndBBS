'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, ArrowBigUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function CommentsSection({ postId, dict, initialCount }: { postId: string, dict: any, initialCount: number }) {
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${postId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
          setCount(data.length);
        }
      } catch (err) {
        console.error('Failed to load comments', err);
      }
    };
    fetchComments();
  }, [postId]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newComment }),
        credentials: 'include'
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setCount(count + 1);
        setNewComment('');
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to post comment');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground mb-4">{dict.post?.comments || 'Comments'} ({count})</h3>
      
      {/* Comment Input */}
      <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50 flex gap-4">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs mt-1">?</div>
        <div className="flex-1 space-y-3">
          <textarea 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y text-foreground"
            placeholder={dict.post?.writeComment || 'Write a comment...'}
          ></textarea>
          <div className="flex justify-end">
            <button 
              onClick={handleSubmit}
              disabled={loading || !newComment.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : (dict.post?.postComment || 'Post')}
            </button>
          </div>
        </div>
      </div>

      {comments.length === 0 ? (
        <div className="text-center text-muted py-4">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="rounded-xl bg-card p-5 shadow-sm border border-border/50">
            <div className="flex space-x-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
                {comment.author?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="flex items-baseline space-x-2">
                  <span className="font-medium text-foreground text-sm">{comment.author?.username || 'Unknown'}</span>
                  <span className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                  {comment.content}
                </p>
                <div className="mt-2 flex items-center space-x-4 text-xs text-muted font-medium">
                  <button className="hover:text-primary flex items-center gap-1"><ArrowBigUp className="h-4 w-4" /> 0</button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
