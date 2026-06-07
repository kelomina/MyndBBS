'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Users,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import type {
  Dictionary,
  WikiWithStats,
  WikiPageWithChildren,
  WikiCollaborator,
  CreateWikiPageData,
} from '../../../types';
import { wikiApi } from '../../../lib/api/wiki';

interface WikiDetailClientProps {
  dict: Dictionary;
  wikiId: string;
}

export function WikiDetailClient({ dict, wikiId }: WikiDetailClientProps) {
  const router = useRouter();
  const [wiki, setWiki] = useState<WikiWithStats | null>(null);
  const [pages, setPages] = useState<WikiPageWithChildren[]>([]);
  const [collaborators, setCollaborators] = useState<WikiCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [createPageForm, setCreatePageForm] = useState<CreateWikiPageData>({
    title: '',
    content: '',
    slug: '',
    parentId: undefined,
  });
  const [showEditWikiModal, setShowEditWikiModal] = useState(false);
  const [editWikiForm, setEditWikiForm] = useState({ title: '', description: '', coverUrl: '' });
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [newCollaboratorUsername, setNewCollaboratorUsername] = useState('');
  const [newCollaboratorRole, setNewCollaboratorRole] = useState<'VIEW' | 'EDIT' | 'ADMIN'>('EDIT');
  const [searchedUsers, setSearchedUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [searchingUser, setSearchingUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWiki = useCallback(async () => {
    try {
      setLoading(true);
      const [wikiData, pagesData, collaboratorsData] = await Promise.all([
        wikiApi.getWikiById(wikiId),
        wikiApi.getWikiPages(wikiId),
        wikiApi.getWikiCollaborators(wikiId),
      ]);
      setWiki(wikiData);
      setPages(pagesData);
      setCollaborators(collaboratorsData);
    } catch (err) {
      console.error('Failed to load wiki:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wiki');
    } finally {
      setLoading(false);
    }
  }, [wikiId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadWiki();
    }, 0);
    return () => clearTimeout(id);
  }, [loadWiki]);

  const togglePageExpand = (pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPageForm.title || !createPageForm.content) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await wikiApi.createWikiPage(wikiId, createPageForm);
      setShowCreatePageModal(false);
      setCreatePageForm({ title: '', content: '', slug: '', parentId: undefined });
      await loadWiki();
    } catch (err) {
      console.error('Failed to create page:', err);
      setError(err instanceof Error ? err.message : 'Failed to create page');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWiki = async () => {
    if (!confirm(dict.wiki.confirmDeleteWiki)) {
      return;
    }

    try {
      setSubmitting(true);
      await wikiApi.deleteWiki(wikiId);
      router.push('/wikis');
    } catch (err) {
      console.error('Failed to delete wiki:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete wiki');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPageTree = (pageList: WikiPageWithChildren[], level = 0) => {
    return pageList.map((page) => (
      <div key={page.id} className="ml-4">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors ${level > 0 ? 'ml-4' : ''}`}
        >
          {page.children.length > 0 && (
            <button
              onClick={() => togglePageExpand(page.id)}
              className="p-1 hover:bg-muted rounded"
            >
              {expandedPages.has(page.id) ? (
                <ChevronDown className="h-4 w-4 text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted" />
              )}
            </button>
          )}
          {page.children.length === 0 && <div className="w-6" />}
          <Link
            href={`/wikis/${wikiId}/pages/${page.id}`}
            className="flex-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {page.title}
          </Link>
          <span className="text-xs text-muted">
            {page.status === 'DRAFT' ? `(${dict.wiki.draft})` : ''}
          </span>
        </div>
        {page.children.length > 0 && expandedPages.has(page.id) && renderPageTree(page.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !wiki) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link href="/wikis" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          {dict.wiki.backToWikis}
        </Link>
        <div className="text-center py-12">
          <p className="text-red-500">{error || dict.wiki.wikiNotFound}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6">
        <Link href="/wikis" className="flex items-center gap-2 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {dict.wiki.backToWikis}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 mb-4">
              <h1 className="text-xl font-bold text-foreground mb-2">{wiki.title}</h1>
              <p className="text-sm text-muted mb-4">{wiki.description}</p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShowCreatePageModal(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="w-full"
                >
                  {dict.wiki.createPage}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowEditWikiModal(true)}
                  leftIcon={<Edit className="h-4 w-4" />}
                  className="w-full"
                >
                  {dict.wiki.editWiki}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowCollaboratorsModal(true)}
                  leftIcon={<Users className="h-4 w-4" />}
                  className="w-full"
                >
                  {dict.wiki.collaborators}
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {dict.wiki.pages}
              </h3>
              {pages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted">
                  <p>{dict.wiki.emptyWiki}</p>
                </div>
              ) : (
                <div className="space-y-1">{renderPageTree(pages)}</div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-card rounded-xl p-8 shadow-sm border border-border/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">{wiki.title}</h2>
              <Button
                variant="danger"
                onClick={handleDeleteWiki}
                leftIcon={<Trash2 className="h-4 w-4" />}
                loading={submitting}
              >
                {dict.wiki.deleteWiki}
              </Button>
            </div>
            <p className="text-muted mb-8">{wiki.description}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">{wiki.pageCount}</div>
                <div className="text-sm text-muted">{dict.wiki.pages}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">{wiki.collaboratorCount}</div>
                <div className="text-sm text-muted">{dict.wiki.collaborators}</div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-border/50 text-sm text-muted">
              <p>{dict.wiki.createdAt}: {new Date(wiki.createdAt).toLocaleDateString()}</p>
              <p>{dict.wiki.updatedAt}: {new Date(wiki.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showCreatePageModal}
        onClose={() => setShowCreatePageModal(false)}
        title={dict.wiki.createPage}
      >
        <form onSubmit={handleCreatePage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.pageTitle}
            </label>
            <input
              type="text"
              value={createPageForm.title}
              onChange={(e) => setCreatePageForm({ ...createPageForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.slug}
            </label>
            <input
              type="text"
              value={createPageForm.slug}
              onChange={(e) => setCreatePageForm({ ...createPageForm, slug: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={dict.wiki.slugHint}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.parentPage}
            </label>
            <select
              value={createPageForm.parentId || ''}
              onChange={(e) => setCreatePageForm({ ...createPageForm, parentId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{dict.wiki.noParent}</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>{page.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.pageContent}
            </label>
            <textarea
              value={createPageForm.content}
              onChange={(e) => setCreatePageForm({ ...createPageForm, content: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
              required
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
              onClick={() => setShowCreatePageModal(false)}
              disabled={submitting}
            >
              {dict.common.cancel}
            </Button>
            <Button type="submit" loading={submitting}>
              {dict.wiki.createPage}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditWikiModal}
        onClose={() => setShowEditWikiModal(false)}
        title={dict.wiki.editWiki}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSubmitting(true);
              await wikiApi.updateWiki(wikiId, editWikiForm);
              setShowEditWikiModal(false);
              await loadWiki();
            } catch (err) {
              console.error('Failed to update wiki:', err);
              setError(err instanceof Error ? err.message : 'Failed to update wiki');
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.wikiTitle}
            </label>
            <input
              type="text"
              value={editWikiForm.title || wiki.title}
              onChange={(e) => setEditWikiForm({ ...editWikiForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {dict.wiki.wikiDescription}
            </label>
            <textarea
              value={editWikiForm.description || wiki.description}
              onChange={(e) => setEditWikiForm({ ...editWikiForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditWikiModal(false)}
              disabled={submitting}
            >
              {dict.common.cancel}
            </Button>
            <Button type="submit" loading={submitting}>
              {dict.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showCollaboratorsModal}
        onClose={() => {
          setShowCollaboratorsModal(false);
          setNewCollaboratorUsername('');
          setSearchedUsers([]);
        }}
        title={dict.wiki.collaborators}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{dict.wiki.addCollaborator}</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCollaboratorUsername}
                onChange={(e) => setNewCollaboratorUsername(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder={dict.wiki.searchUsers}
              />
              <select
                value={newCollaboratorRole}
                onChange={(e) => setNewCollaboratorRole(e.target.value as 'VIEW' | 'EDIT' | 'ADMIN')}
                className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="VIEW">{dict.wiki.roleView}</option>
                <option value="EDIT">{dict.wiki.roleEdit}</option>
                <option value="ADMIN">{dict.wiki.roleAdmin}</option>
              </select>
              <Button
                size="sm"
                loading={searchingUser}
                onClick={async () => {
                  if (!newCollaboratorUsername.trim()) return;
                  try {
                    setSearchingUser(true);
                    const res = await fetch(`/api/search?q=${encodeURIComponent(newCollaboratorUsername.trim())}`, {
                      credentials: 'include',
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setSearchedUsers(data.users || []);
                    }
                  } catch (err) {
                    console.error('Failed to search users:', err);
                  } finally {
                    setSearchingUser(false);
                  }
                }}
              >
                {dict.wiki.addCollaborator}
              </Button>
            </div>
            {searchedUsers.length > 0 && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                {searchedUsers.map((user) => (
                  <button
                    key={user.id}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                    onClick={async () => {
                      try {
                        setSubmitting(true);
                        await wikiApi.addWikiCollaborator(wikiId, {
                          userId: user.id,
                          role: newCollaboratorRole,
                        });
                        setNewCollaboratorUsername('');
                        setSearchedUsers([]);
                        await loadWiki();
                      } catch (err) {
                        console.error('Failed to add collaborator:', err);
                        setError(err instanceof Error ? err.message : 'Failed to add collaborator');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    <span className="text-sm font-medium text-foreground">{user.username}</span>
                    <span className="text-xs text-primary">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{dict.wiki.collaborators}</h4>
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">{dict.wiki.emptyWiki}</p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-foreground text-sm">{collab.user?.username}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={collab.role}
                        onChange={async (e) => {
                          try {
                            await wikiApi.updateWikiCollaborator(wikiId, collab.userId, {
                              role: e.target.value as 'VIEW' | 'EDIT' | 'ADMIN',
                            });
                            await loadWiki();
                          } catch (err) {
                            console.error('Failed to update collaborator:', err);
                          }
                        }}
                        className="px-2 py-1 border border-border rounded bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="VIEW">{dict.wiki.roleView}</option>
                        <option value="EDIT">{dict.wiki.roleEdit}</option>
                        <option value="ADMIN">{dict.wiki.roleAdmin}</option>
                      </select>
                      <button
                        onClick={async () => {
                          try {
                            await wikiApi.removeWikiCollaborator(wikiId, collab.userId);
                            await loadWiki();
                          } catch (err) {
                            console.error('Failed to remove collaborator:', err);
                          }
                        }}
                        className="p-1 text-muted hover:text-red-500 transition-colors"
                        title={dict.wiki.removeCollaborator}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
