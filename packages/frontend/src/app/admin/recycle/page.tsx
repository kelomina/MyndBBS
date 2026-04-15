'use client';
import { useToast } from '../../../components/ui/Toast';
import { useTranslation } from '../../../components/TranslationProvider';
import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import {
  getDeletedPosts,
  getDeletedComments,
  restorePost,
  hardDeletePost,
  restoreComment,
  hardDeleteComment,
} from '../../../lib/api/admin';
import type { RecyclePost, RecycleComment } from '../../../types';

/**
 * Callers: []
 * Callees: [useToast, useTranslation, useState, setLoading, all, getDeletedPosts, getDeletedComments, setPosts, setComments, setError, useEffect, loadData, confirm, restorePost, toast, hardDeletePost, restoreComment, hardDeleteComment, setActiveTab, map, handleRestorePost, handleHardDeletePost, handleRestoreComment, handleHardDeleteComment]
 * Description: Handles the recycle bin page logic for the application.
 * Keywords: recyclebinpage, recycle, bin, page, auto-annotated
 */
export default function RecycleBinPage() {
  const { toast } = useToast();
  const dict = useTranslation();
  const [posts, setPosts] = useState<RecyclePost[]>([]);
  const [comments, setComments] = useState<RecycleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');

  /**
     * Callers: []
     * Callees: [setLoading, all, getDeletedPosts, getDeletedComments, setPosts, setComments, setError]
     * Description: Handles the load data logic for the application.
     * Keywords: loaddata, load, data, auto-annotated
     */
    const loadData = async () => {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([getDeletedPosts(), getDeletedComments()]);
      setPosts(p);
      setComments(c);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
     * Callers: []
     * Callees: [confirm, restorePost, loadData, toast]
     * Description: Handles the handle restore post logic for the application.
     * Keywords: handlerestorepost, handle, restore, post, auto-annotated
     */
    const handleRestorePost = async (id: string) => {
    if (!confirm(dict.admin?.confirmRestore || 'Are you sure you want to restore this item?')) return;
    try {
      await restorePost(id);
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to restore post', 'error');
    }
  };

  /**
     * Callers: []
     * Callees: [confirm, hardDeletePost, loadData, toast]
     * Description: Handles the handle hard delete post logic for the application.
     * Keywords: handleharddeletepost, handle, hard, delete, post, auto-annotated
     */
    const handleHardDeletePost = async (id: string) => {
    if (!confirm(dict.admin?.confirmHardDelete || 'Are you sure you want to permanently delete this item?')) return;
    try {
      await hardDeletePost(id);
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to permanently delete post', 'error');
    }
  };

  /**
     * Callers: []
     * Callees: [confirm, restoreComment, loadData, toast]
     * Description: Handles the handle restore comment logic for the application.
     * Keywords: handlerestorecomment, handle, restore, comment, auto-annotated
     */
    const handleRestoreComment = async (id: string) => {
    if (!confirm(dict.admin?.confirmRestore || 'Are you sure you want to restore this item?')) return;
    try {
      await restoreComment(id);
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to restore comment', 'error');
    }
  };

  /**
     * Callers: []
     * Callees: [confirm, hardDeleteComment, loadData, toast]
     * Description: Handles the handle hard delete comment logic for the application.
     * Keywords: handleharddeletecomment, handle, hard, delete, comment, auto-annotated
     */
    const handleHardDeleteComment = async (id: string) => {
    if (!confirm(dict.admin?.confirmHardDelete || 'Are you sure you want to permanently delete this item?')) return;
    try {
      await hardDeleteComment(id);
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to permanently delete comment', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.admin?.recycleBin || "Recycle Bin"}</h1>
          <p className="text-muted">{dict.admin?.recycleBinDesc || "Manage deleted posts and comments."}</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-border">
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'posts'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('posts')}
        >
          {dict.admin?.deletedPosts || "Deleted Posts"} ({posts.length})
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'comments'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('comments')}
        >
          {dict.admin?.deletedComments || "Deleted Comments"} ({comments.length})
        </button>
      </div>

      <div className="rounded-md border border-border bg-card">
        {activeTab === 'posts' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.admin?.title || "Title"}</TableHead>
                <TableHead>{dict.admin?.author || "Author"}</TableHead>
                <TableHead>{dict.admin?.category || "Category"}</TableHead>
                <TableHead className="text-right">{dict.admin?.actions || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium max-w-xs truncate">{post.title}</TableCell>
                  <TableCell>{post.author?.username}</TableCell>
                  <TableCell>{post.category?.name}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleRestorePost(post.id)}>
                      {dict.admin?.restore || "Restore"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleHardDeletePost(post.id)}
                    >
                      {dict.admin?.permanentDelete || "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-8">
                    {dict.admin?.noDeletedPosts || "No deleted posts."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.admin?.content || "Content"}</TableHead>
                <TableHead>{dict.admin?.author || "Author"}</TableHead>
                <TableHead>{dict.admin?.post || "Post"}</TableHead>
                <TableHead className="text-right">{dict.admin?.actions || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell className="font-medium max-w-xs truncate">{comment.content}</TableCell>
                  <TableCell>{comment.author?.username}</TableCell>
                  <TableCell className="max-w-xs truncate">{comment.post?.title}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleRestoreComment(comment.id)}>
                      {dict.admin?.restore || "Restore"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleHardDeleteComment(comment.id)}
                    >
                      {dict.admin?.permanentDelete || "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {comments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-8">
                    {dict.admin?.noDeletedComments || "No deleted comments."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
