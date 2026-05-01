'use client'

import { useTranslation } from '../../../components/TranslationProvider'
import React, { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/Table'
import { getAuditLogs, type AuditLogEntry } from '../../../lib/api/admin'

const PAGE_SIZE = 50

export default function AuditLogsPage() {
  const dict = useTranslation()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [operatorIdInput, setOperatorIdInput] = useState('')
  const [operationTypeInput, setOperationTypeInput] = useState('')
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useState({
    skip: 0,
    operatorId: '',
    operationType: '',
  })

  useEffect(() => {
    const timerId = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const data = await getAuditLogs({
          skip: searchParams.skip,
          take: PAGE_SIZE,
          operatorId: searchParams.operatorId || undefined,
          operationType: searchParams.operationType || undefined,
        })
        setLogs(data.items)
        setTotal(data.total)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : ''
        setError(
          (dict.apiErrors as Record<string, string>)?.[msg] ||
            msg ||
            dict.admin?.failedToLoadUsers ||
            'Failed to load audit logs',
        )
      } finally {
        setLoading(false)
      }
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [searchParams, dict])

  const handleSearch = () => {
    setSearchParams({
      skip: 0,
      operatorId: operatorIdInput,
      operationType: operationTypeInput,
    })
  }

  const handlePageChange = (newSkip: number) => {
    setSearchParams((prev) => ({ ...prev, skip: newSkip }))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(searchParams.skip / PAGE_SIZE) + 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.admin?.auditLogs || 'Audit Logs'}
        </h1>
        <p className="text-muted">
          {dict.admin?.auditLogsDesc || 'View and manage system audit logs.'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-md border border-border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">
            {dict.admin?.operatorId || 'Operator ID'}
          </label>
          <input
            type="text"
            value={operatorIdInput}
            onChange={(e) => setOperatorIdInput(e.target.value)}
            className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Filter by operator ID"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">
            {dict.admin?.operationType || 'Operation Type'}
          </label>
          <input
            type="text"
            value={operationTypeInput}
            onChange={(e) => setOperationTypeInput(e.target.value)}
            className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Filter by operation type"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {dict.common?.search || 'Search'}
        </button>
      </div>

      {error ? (
        <div className="p-8 text-center text-red-500">{error}</div>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.admin?.operatorId || 'Operator ID'}</TableHead>
                <TableHead>{dict.admin?.permissionGroup || 'Permission Group'}</TableHead>
                <TableHead>{dict.admin?.operationType || 'Operation Type'}</TableHead>
                <TableHead>{dict.admin?.requestPath || 'Request Path'}</TableHead>
                <TableHead>{dict.admin?.ipAddress || 'IP Address'}</TableHead>
                <TableHead>{dict.admin?.timestamp || 'Timestamp'}</TableHead>
                <TableHead>{dict.admin?.actions || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted">
                    {dict.common?.loading || 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted">
                    {dict.admin?.noAuditLogs || 'No audit logs found.'}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.operatorId}</TableCell>
                    <TableCell>{log.permissionGroup}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {log.operationType}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.requestPath}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                    <TableCell className="text-xs text-muted">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.payload && Object.keys(log.payload).length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedPayload(
                              expandedPayload === log.id ? null : log.id,
                            )
                          }
                          className="text-sm font-medium text-primary hover:text-primary/80"
                        >
                          {dict.admin?.viewDetails || 'View Details'}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {expandedPayload && (
            <div className="border-t border-border p-4">
              <div className="mb-2 text-sm font-medium text-muted">
                {dict.admin?.payload || 'Payload'}
              </div>
              <pre className="max-h-64 overflow-auto rounded-md bg-background p-3 text-xs font-mono">
                {JSON.stringify(
                  logs.find((l) => l.id === expandedPayload)?.payload,
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            {dict.common?.total || 'Total'}: {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={searchParams.skip === 0}
              onClick={() =>
                handlePageChange(Math.max(0, searchParams.skip - PAGE_SIZE))
              }
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dict.common?.previous || 'Previous'}
            </button>
            <span className="text-sm text-muted">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={searchParams.skip + PAGE_SIZE >= total}
              onClick={() => handlePageChange(searchParams.skip + PAGE_SIZE)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dict.common?.next || 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
