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
import { getUsers, updateUserRole, updateUserStatus } from '../../../lib/api/admin'
import { UserStatus } from '@myndbbs/shared'

const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  BANNED: 'BANNED',
  PENDING: 'PENDING',
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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
