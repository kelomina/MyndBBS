"use client";
import { useToast } from "../../../components/ui/Toast";

import React, { useState, useEffect, useCallback } from 'react';
import { useCategories } from '../../../lib/hooks';
import { fetcher } from '../../../lib/api/fetcher';
import { Trash2, Check, X, ShieldAlert } from 'lucide-react';
import type { Dictionary, ModerationPost, ModerationComment, ModerationWord } from '../../../types';

type Tab = 'posts' | 'comments' | 'words';

export default function ModerationClient({ dict, canManageWords }: { dict: Dictionary; canManageWords: boolean }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const availableTabs: Tab[] = canManageWords ? ['posts', 'comments', 'words'] : ['posts', 'comments'];
  const [posts, setPosts] = useState<ModerationPost[]>([]);
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [words, setWords] = useState<ModerationWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const { categories } = useCategories();

      const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'posts') {
        const data = await fetcher('/api/admin/moderation/posts');
        setPosts(data.posts);
      } else if (activeTab === 'comments') {
        const data = await fetcher('/api/admin/moderation/comments');
        setComments(data.comments);
      } else if (activeTab === 'words') {
        const data = await fetcher('/api/admin/moderation/words');
        setWords(data.words);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg, 'error');
    }
    setLoading(false);
  }, [activeTab, dict, toast]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchQueue();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchQueue]);

      const handleApprovePost = async (id: string) => {
    try {
      await fetcher(`/api/admin/moderation/posts/${id}/approve`, { method: 'POST' });
      fetchQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg, 'error');
    }
  };

      const handleRejectPost = async (id: string) => {
    try {
      await fetcher(`/api/admin/moderation/posts/${id}/reject`, { method: 'POST' });
      fetchQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg, 'error');
    }
  };

      const handleApproveComment = async (id: string) => {
    try {
      await fetcher(`/api/admin/moderation/comments/${id}/approve`, { method: 'POST' });
      fetchQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg, 'error');
    }
  };

      const handleRejectComment = async (id: string) => {
    try {
      await fetcher(`/api/admin/moderation/comments/${id}/reject`, { method: 'POST' });
      fetchQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg, 'error');
    }
  };

      const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      await fetcher('/api/admin/moderation/words', {
        method: 'POST',
        body: JSON.stringify({ word: newWord.trim(), categoryId: selectedCategory || null })
      });
      setNewWord('');
      setSelectedCategory('');
      fetchQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add word';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg || dict.admin?.failedToAddWord || 'Failed to add word', 'error');
    }
  };

      const handleDeleteWord = async (id: string) => {
    try {
      await fetcher(`/api/admin/moderation/words/${id}`, { method: 'DELETE' });
      fetchQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete word';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground hover:border-border'
                }
              `}
            >
              {tab === 'posts' ? dict.admin?.pendingPosts || "Pending Posts" : 
               tab === 'comments' ? dict.admin?.pendingComments || "Pending Comments" : 
               dict.admin?.moderatedWords || "Moderated Words"}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted">{dict.common?.loading || "Loading..."}</div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {activeTab === 'words' && (
            <div className="p-6 space-y-6">
              <form onSubmit={handleAddWord} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">{dict.admin?.word || "Word"}</label>
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">{dict.admin?.category || "Category (Optional)"}</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">{dict.admin?.globalWord || "Global (All Categories)"}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {dict.admin?.addWord || "Add Word"}
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">{dict.admin?.word || "Word"}</th>
                      <th className="px-4 py-3 font-medium">{dict.admin?.scope || "Scope"}</th>
                      <th className="px-4 py-3 font-medium text-right">{dict.admin?.actions || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {words.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{w.word}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {w.categoryId ? w.category?.name : <span className="text-primary">{dict.admin?.globalWord || "Global"}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteWord(w.id)} className="text-destructive hover:text-destructive/80 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {words.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                          {dict.admin?.noWords || "No moderated words configured"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="divide-y divide-border">
              {posts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">{dict.admin?.noPendingPosts || "No pending posts"}</div>
              ) : posts.map(post => (
                <div key={post.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-muted/30">
                  <div className="space-y-1">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                    <div className="text-xs text-muted-foreground pt-1 flex gap-2">
                      <span>{dict.admin?.author || "Author"}: {post.author?.username}</span>
                      <span>•</span>
                      <span>{post.category?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleApprovePost(post.id)} className="p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50" title={dict.admin?.approve || "Approve"}>
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRejectPost(post.id)} className="p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50" title={dict.admin?.reject || "Reject"}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="divide-y divide-border">
              {comments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">{dict.admin?.noPendingComments || "No pending comments"}</div>
              ) : comments.map(comment => (
                <div key={comment.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-muted/30">
                  <div className="space-y-1">
                    <p className="text-sm text-foreground line-clamp-2 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      {comment.content}
                    </p>
                    <div className="text-xs text-muted-foreground pt-1 flex flex-wrap gap-2">
                      <span>{dict.admin?.author || "Author"}: {comment.author?.username}</span>
                      <span>•</span>
                      <span>{dict.admin?.inPost || "In"}: {comment.post?.title}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleApproveComment(comment.id)} className="p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50" title={dict.admin?.approve || "Approve"}>
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRejectComment(comment.id)} className="p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50" title={dict.admin?.reject || "Reject"}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
