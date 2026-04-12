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
import { getUsers, updateUserRole, updateUserStatus } from '../../../lib/api/admin';
import { UserStatus } from '@prisma/client';

interface User {
  id: string;
  username: string;
  email: string;
  role: string | null;
  status: UserStatus | string;
  createdAt: string;
}

export default function UsersPage() {
  const { toast } = useToast();
  const dict = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      await loadUsers();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateUserStatus(userId, newStatus);
      await loadUsers();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dict.admin?.userManagement || "User Management"}</h1>
        <p className="text-muted">{dict.admin?.userDesc || "Manage system users, their roles and statuses."}</p>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.admin?.username || "Username"}</TableHead>
              <TableHead>{dict.admin?.email || "Email"}</TableHead>
              <TableHead>{dict.admin?.role || "Role"}</TableHead>
              <TableHead>{dict.admin?.status || "Status"}</TableHead>
              <TableHead>{dict.admin?.registered || "Registered"}</TableHead>
              <TableHead>{dict.admin?.actions || "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <select
                    value={user.role || 'USER'}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="USER">{dict.admin?.roleUser || "USER"}</option>
                    <option value="MODERATOR">{dict.admin?.roleModerator || "MODERATOR"}</option>
                    <option value="ADMIN">{dict.admin?.roleAdmin || "ADMIN"}</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === UserStatus.ACTIVE
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : user.status === UserStatus.BANNED
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}
                  >
                    {user.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {user.status === UserStatus.BANNED ? (
                    <button
                      onClick={() => handleStatusChange(user.id, UserStatus.ACTIVE)}
                      className="text-sm font-medium text-green-600 hover:text-green-500 dark:text-green-400"
                    >
                      Unban
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(user.id, UserStatus.BANNED)}
                      className="text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                    >
                      Ban
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
