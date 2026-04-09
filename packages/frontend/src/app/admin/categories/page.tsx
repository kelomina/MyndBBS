'use client';
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
import { Modal } from '../../../components/ui/Modal';
import {
  getCategories,
  createCategory,
  deleteCategory,
  assignCategoryModerator,
  removeCategoryModerator,
  getUsers,
} from '../../../lib/api/admin';

interface Moderator {
  userId: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  moderators: Moderator[];
}

interface User {
  id: string;
  username: string;
  role: string | null;
}

export default function CategoriesPage() {
  const dict = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createData, setCreateData] = useState({ name: '', description: '', sortOrder: 0 });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignData, setAssignData] = useState<{ categoryId: string; userId: string }>({
    categoryId: '',
    userId: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, allUsers] = await Promise.all([getCategories(), getUsers()]);
      setCategories(cats);
      setUsers(allUsers.filter((u: User) => u.role === 'MODERATOR'));
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategory(createData);
      setIsCreateModalOpen(false);
      setCreateData({ name: '', description: '', sortOrder: 0 });
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteCategory(deletingId);
      setIsDeleteModalOpen(false);
      setDeletingId(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const handleAssignModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignData.categoryId || !assignData.userId) return;
    try {
      await assignCategoryModerator(assignData.categoryId, assignData.userId);
      setIsAssignModalOpen(false);
      setAssignData({ categoryId: '', userId: '' });
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to assign moderator');
    }
  };

  const handleRemoveModerator = async (categoryId: string, userId: string) => {
    if (!confirm(dict.admin?.confirmRemoveModerator || 'Are you sure you want to remove this moderator?')) return;
    try {
      await removeCategoryModerator(categoryId, userId);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove moderator');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.admin?.categoryManagement || "Category Management"}</h1>
          <p className="text-muted">{dict.admin?.categoryDesc || "Create and manage forum categories and moderators."}</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>{dict.admin?.createCategory || "Create Category"}</Button>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.admin?.order || "Order"}</TableHead>
              <TableHead>{dict.admin?.name || "Name"}</TableHead>
              <TableHead>{dict.admin?.description || "Description"}</TableHead>
              <TableHead>{dict.admin?.moderators || "Moderators"}</TableHead>
              <TableHead className="text-right">{dict.admin?.actions || "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.description || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {category.moderators?.map((mod) => (
                      <span
                        key={mod.userId}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
                      >
                        {mod.user.username}
                        <button
                          onClick={() => handleRemoveModerator(category.id, mod.userId)}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          title={dict.admin?.removeModerator || "Remove moderator"}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => {
                        setAssignData({ categoryId: category.id, userId: '' });
                        setIsAssignModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      + Add
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={() => {
                      setDeletingId(category.id);
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-8">
                  No categories found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={dict.admin?.createCategory || "Create Category"}
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.name || "Name"}</label>
            <input
              required
              type="text"
              value={createData.name}
              onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.description || "Description"}</label>
            <textarea
              value={createData.description}
              onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.sortOrder || "Sort Order"}</label>
            <input
              type="number"
              value={createData.sortOrder}
              onChange={(e) => setCreateData({ ...createData, sortOrder: Number(e.target.value) })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{dict.admin?.create || "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Moderator Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={dict.admin?.assignModerator || "Assign Moderator"}
      >
        <form onSubmit={handleAssignModerator} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.selectUser || "Select User"}</label>
            <select
              required
              value={assignData.userId}
              onChange={(e) => setAssignData({ ...assignData, userId: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>
                -- Select a moderator --
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
            {users.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No users with MODERATOR role found. Please change a user&apos;s role first.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!assignData.userId}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={dict.admin?.confirmDeletion || "Confirm Deletion"}
      >
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
