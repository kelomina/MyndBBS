'use client'

import { FormEvent, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function SubmitJournalPage() {
  const params = useParams<{ slug: string }>(); const router = useRouter()
  const [title, setTitle] = useState(''); const [abstract, setAbstract] = useState(''); const [file, setFile] = useState<File | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function onSubmit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!file || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) { setError('仅支持 PDF 文件'); return }
    if (file.size > 20 * 1024 * 1024) { setError('PDF 文件不能超过 20 MB'); return }
    setBusy(true)
    try {
      const journalRes = await fetch(`/api/journals/by-slug/${encodeURIComponent(decodeURIComponent(params.slug))}`); if (!journalRes.ok) throw new Error('期刊不存在')
      const journal = await journalRes.json() as { id: string }
      const draftRes = await fetch(`/api/journals/${journal.id}/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ title, abstract: abstract || null }) }); if (!draftRes.ok) throw new Error('投稿创建失败')
      const draft = await draftRes.json() as { id: string; currentVersionId: string }
      const body = new FormData(); body.append('file', file); body.append('versionId', draft.currentVersionId); body.append('journalId', journal.id)
      const fileRes = await fetch(`/api/submissions/${draft.id}/file`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body }); if (!fileRes.ok) throw new Error('PDF 上传失败')
      const submitRes = await fetch(`/api/submissions/${draft.id}/submit`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' }); if (!submitRes.ok) throw new Error('投稿提交失败')
      router.push(`/journals/${encodeURIComponent(params.slug)}`)
    } catch (e) { setError(e instanceof Error ? e.message : '投稿失败') } finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-3xl px-4 py-8"><h1 className="text-2xl font-bold">提交稿件</h1><form onSubmit={onSubmit} className="mt-6 space-y-4"><input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="稿件标题" className="w-full rounded border p-3" /><textarea maxLength={5000} value={abstract} onChange={e => setAbstract(e.target.value)} placeholder="摘要（可选）" className="min-h-32 w-full rounded border p-3" /><input required type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />{error && <p className="text-red-600">{error}</p>}<button disabled={busy} className="rounded bg-primary px-4 py-2 text-white">{busy ? '提交中…' : '提交稿件'}</button></form></main>
}
