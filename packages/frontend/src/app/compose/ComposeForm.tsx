'use client';

import { useState } from 'react';
import { useCategories } from '../../lib/hooks';
import { useRouter } from 'next/navigation';
import { PostEditor } from '../../components/PostEditor';
import { SliderCaptcha } from '../../components/SliderCaptcha';
import { useToast } from '../../components/ui/Toast';
import type { Dictionary } from '../../types';

/**
 * Callers: []
 * Callees: [useToast, useRouter, useState, useCategories, toast, setShowCaptcha, setLoading, fetcher, stringify, push, error, back]
 * Description: Handles the compose form logic for the application.
 * Keywords: composeform, compose, form, auto-annotated
 */
export function ComposeForm({ dict }: { dict: Dictionary }) {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { categories } = useCategories();
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  /**
     * Callers: []
     * Callees: [toast, setShowCaptcha]
     * Description: Handles the handle pre publish logic for the application.
     * Keywords: handleprepublish, handle, pre, publish, auto-annotated
     */
    const handlePrePublish = () => {
    if (!title || !content || !categoryId) {
      toast(dict.apiErrors?.ERR_PLEASE_FILL_ALL || 'Please fill out all fields', 'error');
      return;
    }
    setShowCaptcha(true);
  };

  /**
     * Callers: []
     * Callees: [setShowCaptcha, setLoading, fetcher, stringify, toast, push, error]
     * Description: Handles the handle publish logic for the application.
     * Keywords: handlepublish, handle, publish, auto-annotated
     */
    const handlePublish = async (captchaId: string) => {
    setShowCaptcha(false);
    setLoading(true);
    try {
      const data = await fetcher('/api/posts', {
        method: 'POST',
        headers: { 
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ title, content, categoryId, captchaId })
      });

      if (data.message === 'ERR_PENDING_MODERATION') {
        toast(dict.apiErrors?.ERR_PENDING_MODERATION || "Your content contains moderated words and has been submitted for manual review.", 'info');
        router.push('/');
      } else {
        router.push(`/p/${data.post?.id || data.id}`);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to publish post';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      toast(apiErrors?.[msg] || msg || apiErrors?.ERR_FAILED_TO_PUBLISH || 'Failed to publish post', 'error');
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
          onClick={handlePrePublish}
          disabled={loading}
          className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : dict.post.publish}
        </button>
      </div>

      {showCaptcha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-xl relative">
            <button 
              onClick={() => setShowCaptcha(false)}
              className="absolute top-2 right-2 text-muted hover:text-foreground"
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">{dict.post?.verifyToPublish || "Verify to Publish"}</h3>
            <SliderCaptcha 
              onSuccess={handlePublish} 
              apiUrl={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth`}
            />
          </div>
        </div>
      )}

      <PostEditor dict={dict} title={title} setTitle={setTitle} content={content} setContent={setContent} categoryId={categoryId} setCategoryId={setCategoryId} categories={categories} />
    </>
  );
}
