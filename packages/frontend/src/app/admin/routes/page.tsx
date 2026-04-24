'use client';
import { useToast } from '../../../components/ui/Toast';
import { useTranslation } from '../../../components/TranslationProvider';
import React, { useCallback, useEffect, useState } from 'react';
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
import { ShieldCheck, Plus, Trash2, Edit2, AlertTriangle } from 'lucide-react';
import {
  RouteWhitelist,
  getRouteWhitelist,
  addRouteWhitelist,
  updateRouteWhitelist,
  deleteRouteWhitelist
} from '../../../lib/api/admin';

export default function RoutingWhitelistPage() {
  const dict = useTranslation();
  const { toast } = useToast();
  const [routes, setRoutes] = useState<RouteWhitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{path: string, isPrefix: boolean, minRole: string, description: string}>({ path: '', isPrefix: false, minRole: '', description: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await getRouteWhitelist();
      setRoutes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load route whitelist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loadData]);

      const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.path.startsWith('/')) {
      toast(dict.admin?.pathMustStartWithSlash || 'Path must start with /', 'error');
      return;
    }
    
    try {
      if (editingId) {
        await updateRouteWhitelist(editingId, { ...formData, minRole: formData.minRole || null });
        toast(dict.admin?.routeUpdated || 'Route updated successfully', 'success');
      } else {
        await addRouteWhitelist({ ...formData, minRole: formData.minRole || null });
        toast(dict.admin?.routeAdded || 'Route added successfully', 'success');
      }
      setIsModalOpen(false);
      setFormData({ path: '', isPrefix: false, minRole: '', description: '' });
      setEditingId(null);
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save route', 'error');
    }
  };

      const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteRouteWhitelist(deletingId);
      toast(dict.admin?.routeDeleted || 'Route deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setDeletingId(null);
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to delete route', 'error');
    }
  };

      const openEditModal = (route: RouteWhitelist) => {
    setFormData({ path: route.path, isPrefix: route.isPrefix, minRole: route.minRole || '', description: route.description || '' });
    setEditingId(route.id);
    setIsModalOpen(true);
  };

      const openCreateModal = () => {
    setFormData({ path: '', isPrefix: false, minRole: '', description: '' });
    setEditingId(null);
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {dict.admin?.routingWhitelist || "Routing Whitelist"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {dict.admin?.routingWhitelistDesc || "Configure paths that are accessible without SUPER_ADMIN privileges. Unlisted paths will be strictly intercepted."}
          </p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
          <Plus className="w-4 h-4" />
          {dict.admin?.addRoute || "Add Route"}
        </Button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>{dict.admin?.path || "Path"}</TableHead>
              <TableHead>{dict.admin?.matchType || "Match Type"}</TableHead>
              <TableHead>{dict.admin?.minRole || "Min Role"}</TableHead>
              <TableHead>{dict.admin?.description || "Description"}</TableHead>
              <TableHead className="text-right">{dict.admin?.actions || "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <ShieldCheck className="w-12 h-12 mb-4 text-muted/50" />
                    {dict.admin?.noRoutesFound || "No routes configured. The site is currently strictly restricted."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              routes.map((route) => (
                <TableRow key={route.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-sm">
                    {route.path}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${route.isPrefix ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-secondary-foreground border border-secondary/30'}`}>
                      {route.isPrefix ? (dict.admin?.prefixMatch || "Prefix Match") : (dict.admin?.exactMatch || "Exact Match")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${!route.minRole ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {route.minRole ? route.minRole : (dict.admin?.publicAccess || "Public")}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {route.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(route)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => {
                          setDeletingId(route.id);
                          setIsDeleteModalOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? (dict.admin?.editRoute || "Edit Route") : (dict.admin?.addRoute || "Add Route")}
      >
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {dict.admin?.path || "Path"}
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              placeholder="/example/path"
            />
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <input
              type="checkbox"
              id="isPrefix"
              checked={formData.isPrefix}
              onChange={(e) => setFormData({ ...formData, isPrefix: e.target.checked })}
              className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
            />
            <label htmlFor="isPrefix" className="text-sm font-medium cursor-pointer select-none">
              {dict.admin?.isPrefixMatch || "Prefix Match (allows all sub-paths)"}
            </label>
          </div>

          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {dict.admin?.minRole || "Minimum Role"}
            </label>
            <select
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={formData.minRole}
              onChange={(e) => setFormData({ ...formData, minRole: e.target.value })}
            >
              <option value="">{dict.admin?.publicAccess || "Public (No login required)"}</option>
              <option value="USER">{dict.admin?.roleUser || "User"}</option>
              <option value="MODERATOR">{dict.admin?.roleModerator || "Moderator"}</option>
              <option value="ADMIN">{dict.admin?.roleAdmin || "Admin"}</option>
              <option value="SUPER_ADMIN">{dict.admin?.roleSuperAdmin || "Super Admin"}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {dict.admin?.description || "Description"} <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="E.g., Allow public profile access"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              {dict.common?.cancel || "Cancel"}
            </Button>
            <Button type="submit">
              {editingId ? (dict.common?.save || "Save") : (dict.admin?.addRoute || "Add Route")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={dict.admin?.deleteRoute || "Delete Route"}
      >
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{dict.admin?.confirmDeleteRoute || "Are you sure you want to delete this route? Unlisted paths will be blocked."}</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {dict.common?.cancel || "Cancel"}
            </Button>
            <Button variant="outline" className="bg-red-600 text-white hover:bg-red-700 hover:text-white border-transparent" onClick={handleDelete}>
              {dict.common?.delete || "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
