'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCategories } from '../../lib/hooks';
import { useRouter } from 'next/navigation';
import { fetcher } from '@/lib/api/fetcher';
import { PostEditor } from '../../components/PostEditor';
import { SliderCaptcha } from '../../components/SliderCaptcha';
import { useToast } from '../../components/ui/Toast';
import type { Dictionary } from '../../types';

interface DraftData {
  title: string;
  content: string;
  categoryId: string | null;
  updatedAt: string;
}

const AUTOSAVE_INTERVAL_MS = 8000;

export function ComposeForm({ dict }: { dict: Dictionary }) {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const { categories } = useCategories();
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  // ── 草稿状态 ──
  const [draftBanner, setDraftBanner] = useState<DraftData | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string; categoryId: string }>({ title: '', content: '', categoryId: '' });
  const draftDirtyRef = useRef(false);

  const currentSnapshot = useCallback(
    () => ({ title, content, categoryId }),
    [title, content, categoryId]
  );

  const saveDraft = useCallback(
    async (snapshot: { title: string; content: string; categoryId: string }) => {
      try {
        await fetcher('/api/v1/drafts/post', {
          method: 'PUT',
          body: JSON.stringify(snapshot),
        });
        lastSavedRef.current = snapshot;
      } catch {
        // 草稿保存失败静默（不打断编辑）
      }
    },
    []
  );

  const clearDraft = useCallback(async () => {
    try {
      await fetcher('/api/v1/drafts/post', { method: 'DELETE' });
    } catch {
      // 忽略清理失败
    }
    lastSavedRef.current = { title: '', content: '', categoryId: '' };
    draftDirtyRef.current = false;
  }, []);

  // 挂载时拉取草稿：有内容则展示恢复横幅，否则清空旧草稿槽位
  useEffect(() => {
    let cancelled = false;
    fetcher('/api/v1/drafts/post')
      .then((data) => {
        if (cancelled) return;
        const draft = data.draft as DraftData | null;
        if (draft && (draft.title.trim() || draft.content.trim())) {
          setDraftBanner(draft);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // 自动保存：内容与上次保存快照不同时每 8 秒写一次
  useEffect(() => {
    const timerId = window.setInterval(() => {
      const snapshot = currentSnapshot();
      const last = lastSavedRef.current;
      const dirty =
        snapshot.title !== last.title ||
        snapshot.content !== last.content ||
        snapshot.categoryId !== last.categoryId;
      if (dirty && (snapshot.title.trim() || snapshot.content.trim())) {
        draftDirtyRef.current = true;
        void saveDraft(snapshot);
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, [currentSnapshot, saveDraft]);

  const restoreDraft = () => {
    if (!draftBanner) return;
    setTitle(draftBanner.title);
    setContent(draftBanner.content);
    setCategoryId(draftBanner.categoryId ?? '');
    lastSavedRef.current = {
      title: draftBanner.title,
      content: draftBanner.content,
      categoryId: draftBanner.categoryId ?? '',
    };
    setDraftBanner(null);
  };

  const discardDraft = async () => {
    await clearDraft();
    setDraftBanner(null);
    toast(dict.post?.draftDiscarded || 'Draft discarded', 'info');
  };

      const handlePrePublish = () => {
    if (!title || !content || !categoryId) {
      toast(dict.apiErrors?.ERR_PLEASE_FILL_ALL || 'Please fill out all fields', 'error');
      return;
    }
    setShowCaptcha(true);
  };

      const handlePublish = async (captchaId: string) => {
    setShowCaptcha(false);
    setLoading(true);
    try {
      const tags = tagsInput
        .split(/[,，]/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 5);
      const data = await fetcher('/api/posts', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ title, content, categoryId, captchaId, ...(tags.length ? { tags } : {}) })
      });

      void clearDraft();

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
      {draftBanner && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
          <span className="text-muted">
            {(dict.post?.draftFound || 'Unpublished draft from {time}').replace(
              '{time}',
              new Date(draftBanner.updatedAt).toLocaleString()
            )}
          </span>
          <button
            onClick={restoreDraft}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {dict.post?.draftRestore || 'Restore'}
          </button>
          <button
            onClick={() => void discardDraft()}
            className="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400"
          >
            {dict.post?.draftDiscardAction || 'Discard'}
          </button>
        </div>
      )}
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
              apiUrl={`/api/v1/auth`}
            />
          </div>
        </div>
      )}

      <PostEditor dict={dict} title={title} setTitle={setTitle} content={content} setContent={setContent} categoryId={categoryId} setCategoryId={setCategoryId} categories={categories} />

      <div className="mt-4">
        <label htmlFor="post-tags" className="text-sm font-medium text-muted-foreground">
          {dict.post?.tagsLabel || 'Tags (comma-separated, max 5)'}
        </label>
        <input
          id="post-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={dict.post?.tagsPlaceholder || 'tech, life, q&a'}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </>
  );
}
