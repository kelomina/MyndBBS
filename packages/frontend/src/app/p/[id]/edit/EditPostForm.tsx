'use client';

import { useState } from 'react';
import { useCategories } from '../../../../lib/hooks';
import { fetcher } from '../../../../lib/api/fetcher';
import { useRouter } from 'next/navigation';
import { PostEditor } from '../../../../components/PostEditor';
import { useToast } from '../../../../components/ui/Toast';
import type { Dictionary, EditablePost } from '../../../../types';

/**
 * Callers: []
 * Callees: [useToast, useRouter, useState, useCategories, toast, setLoading, fetcher, stringify, push, error, back]
 * Description: Handles the edit post form logic for the application.
 * Keywords: editpostform, edit, post, form, auto-annotated
 */
export function EditPostForm({ dict, initialPost }: { dict: Dictionary; initialPost: EditablePost }) {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState(initialPost.title);
  const [content, setContent] = useState(initialPost.content);
  const [categoryId, setCategoryId] = useState(initialPost.categoryId);
  const { categories } = useCategories();
  const [loading, setLoading] = useState(false);

  /**
     * Callers: []
     * Callees: [toast, setLoading, fetcher, stringify, push, error]
     * Description: Handles the handle publish logic for the application.
     * Keywords: handlepublish, handle, publish, auto-annotated
     */
    const handlePublish = async () => {
    if (!title || !content || !categoryId) {
      toast(dict.common?.pleaseFillAllFields || 'Please fill out all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await fetcher(`/api/posts/${initialPost.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, categoryId })
      });

      if (data.message === 'ERR_PENDING_MODERATION') {
        toast(dict.apiErrors?.ERR_PENDING_MODERATION || "Your content contains moderated words and has been submitted for manual review.", 'info');
        router.push('/');
      } else {
        router.push(`/p/${initialPost.id}`);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to update post';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg || apiErrors?.ERR_FAILED_TO_UPDATE || 'Failed to update post', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center text-sm font-medium text-muted hover:text-foreground transition-colors">
          &larr; {dict.post.backToHome}
        </button>
        <button 
          onClick={handlePublish}
          disabled={loading}
          className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : dict.post.save || 'Save'}
        </button>
      </div>

      <PostEditor dict={dict} title={title} setTitle={setTitle} content={content} setContent={setContent} categoryId={categoryId} setCategoryId={setCategoryId} categories={categories} />
    </>
  );
}
