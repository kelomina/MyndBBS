'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  History,
  Loader2,
  Save,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/Button';
import { Modal } from '../../../../../components/ui/Modal';
import type {
  Dictionary,
  WikiPage,
  WikiPageHistory,
  UpdateWikiPageData,
} from '../../../../../types';
import { wikiApi } from '../../../../../lib/api/wiki';

interface WikiPageDetailClientProps {
  dict: Dictionary;
  wikiId: string;
  pageId: string;
}

export function WikiPageDetailClient({ dict, wikiId, pageId }: WikiPageDetailClientProps) {
  const router = useRouter();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [history, setHistory] = useState<WikiPageHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateWikiPageData>({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      const data = await wikiApi.getWikiPage(wikiId, pageId);
      setPage(data);
      setEditForm({
        title: data.title,
        content: data.content,
        slug: data.slug,
        status: data.status,
      });
    } catch (err) {
      console.error('Failed to load page:', err);
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }, [wikiId, pageId]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await wikiApi.getWikiPageHistory(wikiId, pageId);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load page history:', err);
    }
  }, [wikiId, pageId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadPage();
    }, 0);
    return () => clearTimeout(id);
  }, [loadPage]);

  const handleSaveEdit = async () => {
    if (!editForm.title || !editForm.content) {
      return;
    }

    try {
      setSubmitting(true);
      await wikiApi.updateWikiPage(wikiId, pageId, editForm);
      setIsEditing(false);
      await loadPage();
    } catch (err) {
      console.error('Failed to update page:', err);
      setError(err instanceof Error ? err.message : 'Failed to update page');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePage = async () => {
    if (!confirm(dict.wiki.confirmDeletePage)) {
      return;
    }

    try {
      setSubmitting(true);
      await wikiApi.deleteWikiPage(wikiId, pageId);
      router.push(`/wikis/${wikiId}`);
    } catch (err) {
      console.error('Failed to delete page:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete page');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevertVersion = async (versionId: string) => {
    try {
      setSubmitting(true);
      await wikiApi.revertWikiPageToVersion(wikiId, pageId, versionId);
      setShowHistoryModal(false);
      await loadPage();
    } catch (err) {
      console.error('Failed to revert version:', err);
      setError(err instanceof Error ? err.message : 'Failed to revert version');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link
          href={`/wikis/${wikiId}`}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.wiki.backToWiki}
        </Link>
        <div className="text-center py-12">
          <p className="text-red-500">{error || dict.wiki.pageNotFound}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6">
        <Link
          href={`/wikis/${wikiId}`}
          className="flex items-center gap-2 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.wiki.backToWiki}
        </Link>
      </div>

      <div className="bg-card rounded-xl p-8 shadow-sm border border-border/50">
        <div className="flex items-center justify-between mb-6">
          {isEditing ? (
            <input
              type="text"
              value={editForm.title || page.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="text-3xl font-bold text-foreground bg-transparent border-none focus:outline-none w-full"
            />
          ) : (
            <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          )}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      title: page.title,
                      content: page.content,
                      slug: page.slug,
                      status: page.status,
                    });
                  }}
                  disabled={submitting}
                >
                  {dict.common.cancel}
                </Button>
                <Button onClick={handleSaveEdit} loading={submitting} leftIcon={<Save className="h-4 w-4" />}>
                  {dict.common.save}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    loadHistory();
                    setShowHistoryModal(true);
                  }}
                  leftIcon={<History className="h-4 w-4" />}
                >
                  {dict.wiki.history}
                </Button>
                <Button onClick={() => setIsEditing(true)} leftIcon={<Edit className="h-4 w-4" />}>
                  {dict.wiki.editPage}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeletePage}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  loading={submitting}
                >
                  {dict.wiki.deletePage}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-6 text-sm text-muted">
          {dict.wiki.status}: {page.status === 'DRAFT' ? dict.wiki.draft : page.status === 'PUBLISHED' ? dict.wiki.published : dict.wiki.archived}
          {' • '}
          {dict.wiki.updatedAt}: {new Date(page.updatedAt).toLocaleDateString()}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {dict.wiki.slug}
              </label>
              <input
                type="text"
                value={editForm.slug || page.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {dict.wiki.status}
              </label>
              <select
                value={editForm.status || page.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="DRAFT">{dict.wiki.draft}</option>
                <option value="PUBLISHED">{dict.wiki.published}</option>
                <option value="ARCHIVED">{dict.wiki.archived}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {dict.wiki.pageContent}
              </label>
              <textarea
                value={editForm.content || page.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[400px] font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap">{page.content}</div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={dict.wiki.history}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-center text-muted py-8">{dict.common.noData}</p>
          ) : (
            history.map((version) => (
              <div
                key={version.id}
                className="p-4 border border-border rounded-lg bg-muted/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-foreground">{version.title}</div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRevertVersion(version.id)}
                    loading={submitting}
                  >
                    {dict.wiki.revertToVersion}
                  </Button>
                </div>
                <div className="text-sm text-muted mb-2">
                  {dict.wiki.updatedAt}: {new Date(version.createdAt).toLocaleString()}
                  {version.editor?.username && ` • ${version.editor.username}`}
                </div>
                <div className="text-sm text-muted line-clamp-3">
                  {version.content}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
