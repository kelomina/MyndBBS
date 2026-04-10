'use client';

import { useState, useEffect, useMemo } from 'react';

import { useCurrentUser } from '../../../lib/hooks';
import { useRouter } from 'next/navigation';
import { CommentItem } from './CommentItem';
import { SliderCaptcha } from '../../../components/SliderCaptcha';
import { fetcher } from '../../../lib/api/fetcher';


export function CommentsSection({ postId, dict, initialCount }: { postId: string, dict: any, initialCount: number }) {
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [replyTo, setReplyTo] = useState<{ id: string, username: string } | null>(null);
  const { user: currentUser } = useCurrentUser();
  const [showCaptcha, setShowCaptcha] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await fetcher(`/api/posts/${postId}/comments`);
        setComments(data);
        setCount(data.length);
      } catch (err) {
        console.error('Failed to load comments', err);
      }
    };
    fetchComments();
  }, [postId]);

  const handlePreSubmit = () => {
    if (!newComment.trim()) return;
    setShowCaptcha(true);
  };

  const handleSubmit = async (captchaId: string) => {
    setShowCaptcha(false);
    setLoading(true);
    try {
      const data = await fetcher(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment, parentId: replyTo?.id, captchaId })
      });
      
      if (data.message === 'ERR_PENDING_MODERATION') {
        alert(dict.apiErrors?.ERR_PENDING_MODERATION || "Your content contains moderated words and has been submitted for manual review.");
        setNewComment('');
        setReplyTo(null);
        return;
      }
      
      setComments([...comments, data]);
      setCount(count + 1);
      setNewComment('');
      setReplyTo(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || dict.apiErrors?.ERR_FAILED_TO_POST_COMMENT || 'Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = (parentId: string) => {
    const parentComment = comments.find(c => c.id === parentId);
    if (parentComment) {
      setReplyTo({ id: parentId, username: parentComment.author?.username || 'Unknown' });
      // scroll to input
      document.getElementById('comment-input-area')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const commentTree = useMemo(() => {
    const map = new Map<string, any>();
    const roots: any[] = [];

    comments.forEach(c => {
      map.set(c.id, { ...c, children: [] });
    });

    comments.forEach(c => {
      const node = map.get(c.id);
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [comments]);

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(dict.post?.confirmDeleteComment || 'Are you sure you want to delete this comment?')) return;
    try {
      await fetcher(`/api/posts/comments/${commentId}`, { method: 'DELETE' });
      setComments(comments.map(c => c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c));
    } catch (err: any) {
      console.error(err);
      alert(err.message || dict.apiErrors?.ERR_FAILED_TO_DELETE_COMMENT || 'Failed to delete comment');
    }
  };

  const renderCommentNode = (node: any, depth = 0) => (
    <div key={node.id} className={`${depth > 0 ? 'ml-8 mt-4 border-l-2 border-border pl-4' : 'mt-4'}`}>
      <CommentItem 
        comment={node} 
        dict={dict} 
        onReply={handleReply} 
        onDelete={() => handleDeleteComment(node.id)}
        currentUser={currentUser}
      />
      {node.children && node.children.length > 0 && (
        <div className="space-y-4">
          {node.children.map((child: any) => renderCommentNode(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4" id="comment-input-area">
      <h3 className="text-lg font-bold text-foreground mb-4">{dict.post?.comments || 'Comments'} ({count})</h3>
      
      {showCaptcha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-xl relative">
            <button 
              onClick={() => setShowCaptcha(false)}
              className="absolute top-2 right-2 text-muted hover:text-foreground"
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">{dict.post?.verifyToPostComment || "Verify to Post Comment"}</h3>
            <SliderCaptcha 
              onSuccess={handleSubmit} 
              apiUrl={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth`}
            />
          </div>
        </div>
      )}

      {/* Comment Input */}
      <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50 flex gap-4 flex-col">
        {replyTo && (
          <div className="flex items-center justify-between text-sm text-muted bg-background p-2 rounded-lg border border-border">
            <span>{dict.post?.replyingTo || "Replying to"} <span className="font-medium text-foreground">{replyTo.username}</span></span>
            <button onClick={() => setReplyTo(null)} className="hover:text-foreground">{dict.common?.cancel || "Cancel"}</button>
          </div>
        )}
        <div className="flex gap-4">
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
                onClick={handlePreSubmit}
                disabled={loading || !newComment.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? '...' : (dict.post?.postComment || 'Post')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {comments.length === 0 ? (
        <div className="text-center text-muted py-4">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-0">
          {commentTree.map(rootNode => renderCommentNode(rootNode))}
        </div>
      )}
    </div>
  );
}
