'use client'
import { useToast } from '../../../components/ui/Toast'
import { useTranslation } from '../../../components/TranslationProvider'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { useCurrentUser } from '../../../lib/hooks'
import {
  createTestAccount,
  deleteUser,
  getUsers,
  updateUserRole,
  updateUserStatus,
  type CreatedTestAccount,
} from '../../../lib/api/admin'
import { UserStatus } from '@myndbbs/shared'
import { AlertTriangle, FlaskConical, Trash2 } from 'lucide-react'

const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  BANNED: 'BANNED',
  PENDING: 'PENDING',
  INACTIVE: 'INACTIVE',
} as const

interface User {
  id: string
  username: string
  email: string
  role: string | null
  status: UserStatus | string
  createdAt: string
}

export default function UsersPage() {
  const { toast } = useToast()
  const dict = useTranslation()
  const { user: currentUser } = useCurrentUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [testAccountModalOpen, setTestAccountModalOpen] = useState(false)
  const [testAccountLoading, setTestAccountLoading] = useState(false)
  const [createdTestAccount, setCreatedTestAccount] = useState<CreatedTestAccount | null>(null)
  const [testAccountForm, setTestAccountForm] = useState({
    username: 'test_',
    email: '',
    password: '',
  })
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  /**
   * 加载用户列表
   * @param query 搜索关键字
   */
  const loadUsers = useCallback(async (query?: string): Promise<void> => {
    try {
      setLoading(true)
      const data = await getUsers(query)
      setUsers(data)
      setError('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToLoadUsers ||
          'Failed to load users',
      )
    } finally {
      setLoading(false)
    }
  }, [dict])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadUsers(searchQuery)
    }, 300)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadUsers, searchQuery])

  /**
   * 处理用户角色变更
   * @param userId 用户 ID
   * @param newRole 新角色
   */
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole)
      await loadUsers(searchQuery)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToUpdateRole ||
          'Failed to update role',
        'error',
      )
    }
  }

  /**
   * 处理用户状态变更
   * @param userId 用户 ID
   * @param newStatus 新状态
   */
  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateUserStatus(userId, newStatus)
      await loadUsers(searchQuery)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToUpdateStatus ||
          'Failed to update status',
        'error',
      )
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    try {
      setDeleteLoading(true)
      await deleteUser(deletingUser.id)
      toast(dict.admin?.userDeleted || 'User deleted', 'success')
      setDeletingUser(null)
      await loadUsers(searchQuery)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToDeleteUser ||
          'Failed to delete user',
        'error',
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCreateTestAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setTestAccountLoading(true)
      const result = await createTestAccount(testAccountForm)
      setCreatedTestAccount(result.user)
      toast(dict.admin?.testAccountCreated || 'Test account created', 'success')
      await loadUsers(searchQuery)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToCreateTestAccount ||
          'Failed to create test account',
        'error',
      )
    } finally {
      setTestAccountLoading(false)
    }
  }

  const closeTestAccountModal = () => {
    if (testAccountLoading) return
    setTestAccountModalOpen(false)
    setCreatedTestAccount(null)
    setTestAccountForm({ username: 'test_', email: '', password: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {dict.admin?.userManagement || 'User Management'}
          </h1>
          <p className="text-muted">
            {dict.admin?.userDesc || 'Manage system users, their roles and statuses.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {isSuperAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestAccountModalOpen(true)}
              leftIcon={<FlaskConical className="h-4 w-4" />}
            >
              {dict.admin?.createTestAccount || 'Create test account'}
            </Button>
          )}
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder={dict.common?.search || 'Search users...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center text-red-500">{error}</div>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.admin?.username || 'Username'}</TableHead>
                <TableHead>{dict.admin?.email || 'Email'}</TableHead>
                <TableHead>{dict.admin?.role || 'Role'}</TableHead>
                <TableHead>{dict.admin?.status || 'Status'}</TableHead>
                <TableHead>{dict.admin?.registered || 'Registered'}</TableHead>
                <TableHead>{dict.admin?.actions || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted">
                    {dict.common?.loading || 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted">
                    {dict.common?.noData || 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <select
                        value={user.role || 'USER'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={user.status === USER_STATUS.INACTIVE}
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="USER">{dict.admin?.roleUser || 'USER'}</option>
                        <option value="MODERATOR">{dict.admin?.roleModerator || 'MODERATOR'}</option>
                        <option value="ADMIN">{dict.admin?.roleAdmin || 'ADMIN'}</option>
                        <option value="SUPER_ADMIN">
                          {dict.admin?.roleSuperAdmin || 'SUPER_ADMIN'}
                        </option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.status === USER_STATUS.ACTIVE
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : user.status === USER_STATUS.BANNED
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : user.status === USER_STATUS.INACTIVE
                                ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
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
                      {user.status === USER_STATUS.INACTIVE ? (
                        <span className="text-sm text-muted">
                          {dict.admin?.deletedUser || 'Deleted user'}
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          {user.status === USER_STATUS.BANNED ? (
                            <button
                              onClick={() => handleStatusChange(user.id, USER_STATUS.ACTIVE)}
                              className="text-sm font-medium text-green-600 hover:text-green-500 dark:text-green-400"
                            >
                              {dict.admin?.unban || 'Unban'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(user.id, USER_STATUS.BANNED)}
                              className="text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                            >
                              {dict.admin?.ban || 'Ban'}
                            </button>
                          )}
                          <button
                            onClick={() => setDeletingUser(user)}
                            className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            {dict.admin?.deleteUser || 'Delete'}
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={Boolean(deletingUser)}
        onClose={() => {
          if (!deleteLoading) setDeletingUser(null)
        }}
        title={dict.admin?.confirmDeleteUserTitle || 'Delete user'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                {deletingUser?.username} ({deletingUser?.email})
              </p>
              <p>
                {dict.admin?.confirmDeleteUser ||
                  'This will remove the account personal information and cannot be restored.'}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={deleteLoading}
              onClick={() => setDeletingUser(null)}
            >
              {dict.common?.cancel || 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteLoading}
              onClick={handleDeleteUser}
            >
              {dict.admin?.deleteUser || 'Delete user'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={testAccountModalOpen}
        onClose={closeTestAccountModal}
        title={dict.admin?.createTestAccount || 'Create test account'}
      >
        {createdTestAccount ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
              {dict.admin?.testAccountCreatedHint ||
                'The test account is ready. Copy the password now; it will not be shown again.'}
            </div>
            <div className="space-y-3 rounded-md border border-border p-4 text-sm">
              <div>
                <p className="text-muted">{dict.admin?.username || 'Username'}</p>
                <p className="font-mono">{createdTestAccount.username}</p>
              </div>
              <div>
                <p className="text-muted">{dict.admin?.email || 'Email'}</p>
                <p className="font-mono">{createdTestAccount.email}</p>
              </div>
              <div>
                <p className="text-muted">{dict.admin?.password || 'Password'}</p>
                <p className="font-mono">{testAccountForm.password}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={closeTestAccountModal}>
                {dict.common?.close || 'Close'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateTestAccount} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="test-account-username">
                {dict.admin?.username || 'Username'}
              </label>
              <input
                id="test-account-username"
                type="text"
                value={testAccountForm.username}
                onChange={(e) =>
                  setTestAccountForm((prev) => ({ ...prev, username: e.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="test_qa01"
                required
              />
              <p className="text-xs text-muted">
                {dict.admin?.testAccountUsernameHint ||
                  'Use a test_ prefix, for example test_qa01.'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="test-account-email">
                {dict.admin?.email || 'Email'}
              </label>
              <input
                id="test-account-email"
                type="email"
                value={testAccountForm.email}
                onChange={(e) =>
                  setTestAccountForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="test_qa01@example.test"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="test-account-password">
                {dict.admin?.password || 'Password'}
              </label>
              <input
                id="test-account-password"
                type="password"
                value={testAccountForm.password}
                onChange={(e) =>
                  setTestAccountForm((prev) => ({ ...prev, password: e.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <p className="text-xs text-muted">
                {dict.admin?.testAccountPasswordHint ||
                  'Use 8-128 ASCII characters with uppercase, lowercase, number, and special character.'}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={testAccountLoading}
                onClick={closeTestAccountModal}
              >
                {dict.common?.cancel || 'Cancel'}
              </Button>
              <Button type="submit" loading={testAccountLoading}>
                {dict.admin?.createTestAccount || 'Create test account'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
