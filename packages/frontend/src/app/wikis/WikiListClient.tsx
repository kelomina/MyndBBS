'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, BookOpen, Users, FileText, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Dictionary, WikiWithStats, WikiCreationLimitInfo } from '../../types';
import { wikiApi } from '../../lib/api/wiki';

interface WikiListClientProps {
  dict: Dictionary;
}

export function WikiListClient({ dict }: WikiListClientProps) {
  const [wikis, setWikis] = useState<WikiWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', coverUrl: '' });
  const [creationLimit, setCreationLimit] = useState<WikiCreationLimitInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWikis = useCallback(async () => {
    try {
      setLoading(true);
      const data = await wikiApi.getAllWikis();
      setWikis(data);
    } catch (err) {
      console.error('Failed to load wikis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wikis');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCreationLimit = useCallback(async () => {
    try {
      const data = await wikiApi.getWikiCreationLimit();
      setCreationLimit(data);
    } catch (err) {
      console.error('Failed to load creation limit:', err);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadWikis();
      void loadCreationLimit();
    }, 0);
    return () => clearTimeout(id);
  }, [loadWikis, loadCreationLimit]);

  const handleCreateWiki = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.description) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await wikiApi.createWiki({
        title: createForm.title,
        description: createForm.description,
        coverUrl: createForm.coverUrl || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', coverUrl: '' });
      await loadWikis();
      await loadCreationLimit();
    } catch (err) {
      console.error('Failed to create wiki:', err);
      setError(err instanceof Error ? err.message : 'Failed to create wiki');
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = creationLimit?.canCreate ?? true;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{dict.wiki.title}</h1>
          {creationLimit && (
            <p className="text-sm text-muted mt-1">
              {dict.wiki.wikiLimitInfo.replace('{current}', String(creationLimit.currentCount)).replace('{max}', String(creationLimit.maxCount))}
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          disabled={!canCreate}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          {dict.wiki.createWiki}
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : wikis.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted opacity-50" />
          <p className="text-muted">{dict.wiki.noWikisFound}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wikis.map((wiki) => (
            <Link
              key={wiki.id}
              href={`/wikis/${wiki.id}`}
              className="group rounded-xl bg-card p-5 shadow-sm transition-all hover:shadow-md border border-border/50"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {wiki.title}
                </h3>
              </div>
              <p className="text-sm text-muted line-clamp-3 mb-4">
                {wiki.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{wiki.pageCount} {dict.wiki.pages}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{wiki.collaboratorCount} {dict.wiki.collaborators}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted">
                {dict.wiki.updatedAt}: {new Date(wiki.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={dict.wiki.createWiki}
      >
        <form onSubmit={handleCreateWiki} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.wikiTitle}
            </label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={dict.wiki.wikiTitle}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.wikiDescription}
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
              placeholder={dict.wiki.wikiDescription}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.wikiCover}
            </label>
            <input
              type="url"
              value={createForm.coverUrl}
              onChange={(e) => setCreateForm({ ...createForm, coverUrl: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com/cover.jpg"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
            >
              {dict.common.cancel}
            </Button>
            <Button type="submit" loading={submitting}>
              {dict.wiki.createWiki}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
