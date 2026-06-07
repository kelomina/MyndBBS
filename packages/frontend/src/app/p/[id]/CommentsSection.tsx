'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'

import { useCurrentUser } from '../../../lib/hooks'
import { CommentItem } from './CommentItem'
import { SliderCaptcha } from '../../../components/SliderCaptcha'
import { useToast } from '../../../components/ui/Toast'
import { Avatar } from '../../../components/Avatar'
import { fetcher } from '../../../lib/api/fetcher'
import type { Dictionary, PostComment } from '../../../types'

const MAX_DEPTH = 2
const PREVIEW_COUNT = 2
const PAGE_SIZE = 10

type ChildState = {
  comments: PostComment[]
  total: number
  collapsed: boolean
  currentPage: number
  previewComments?: PostComment[]
}

type CommentWithCounts = PostComment & {
  _count?: {
    upvotes?: number
    replies?: number
  }
}

export function CommentsSection({ postId, dict, initialCount }: { postId: string; dict: Dictionary; initialCount: number }) {
  const { toast } = useToast()
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const { user: currentUser } = useCurrentUser()
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())

  const [rootPage, setRootPage] = useState(1)
  const [rootPages, setRootPages] = useState<Map<number, { comments: PostComment[]; total: number }>>(new Map())
  const [childStates, setChildStates] = useState<Map<string, ChildState>>(new Map())

  const initialLoadDone = useRef(false)

  const fetchPreviewReplies = useCallback(async (comments: PostComment[]) => {
    const commentsWithReplies = comments.filter(c => ((c as CommentWithCounts)._count?.replies ?? 0) > 0)
    if (commentsWithReplies.length === 0) return comments

    const previewPairs: Array<readonly [string, PostComment[]]> = await Promise.all(
      commentsWithReplies.map(async comment => {
        try {
          const result = (await fetcher(
            `/api/posts/${postId}/comments?parentId=${comment.id}&skip=0&take=${PREVIEW_COUNT}`,
          )) as { data: PostComment[]; total: number }
          return [comment.id, result.data] as const
        } catch {
          return [comment.id, [] as PostComment[]] as const
        }
      }),
    )

    const previewsById = new Map(previewPairs)
    return comments.map(comment => ({
      ...comment,
      previewReplies: previewsById.get(comment.id) ?? comment.previewReplies,
    }))
  }, [postId])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    ;(async () => {
      const key = 'root:1'
      setLoadingKeys(prev => new Set(prev).add(key))
      try {
        const result = (await fetcher(
          `/api/posts/${postId}/comments?parentId=null&skip=0&take=${PAGE_SIZE}`,
        )) as { data: PostComment[]; total: number }
        const comments = await fetchPreviewReplies(result.data)
        setRootPages(prev => {
          const next = new Map(prev)
          next.set(1, { comments, total: result.total })
          return next
        })
      } catch (err) {
        console.error('Failed to load root comments', err)
      } finally {
        setLoadingKeys(prev => {
          const n = new Set(prev)
          n.delete(key)
          return n
        })
      }
    })()
  }, [fetchPreviewReplies, postId])

  const loadRootPage = async (page: number) => {
    const key = `root:${page}`
    if (loadingKeys.has(key)) return
    setLoadingKeys(prev => new Set(prev).add(key))
    try {
      const skip = (page - 1) * PAGE_SIZE
      const result = (await fetcher(
        `/api/posts/${postId}/comments?parentId=null&skip=${skip}&take=${PAGE_SIZE}`,
      )) as { data: PostComment[]; total: number }
      const comments = await fetchPreviewReplies(result.data)
      setRootPages(prev => {
        const next = new Map(prev)
        next.set(page, { comments, total: result.total })
        return next
      })
    } catch (err) {
      console.error('Failed to load root page', err)
    } finally {
      setLoadingKeys(prev => {
        const n = new Set(prev)
        n.delete(key)
        return n
      })
    }
  }

  const loadDirectChildren = async (parentId: string) => {
    const key = `children:${parentId}`
    if (loadingKeys.has(key)) return
    setLoadingKeys(prev => new Set(prev).add(key))
    try {
      const result = (await fetcher(
        `/api/posts/${postId}/comments?parentId=${parentId}&take=100`,
      )) as { data: PostComment[]; total: number }
      const comments = await fetchPreviewReplies(result.data)
      setChildStates(prev => {
        const next = new Map(prev)
        const existing = next.get(parentId)
        next.set(parentId, {
          comments,
          total: result.total,
          collapsed: false,
          currentPage: 1,
          previewComments: existing?.previewComments,
        })
        return next
      })
    } catch (err) {
      console.error('Failed to load direct children', err)
    } finally {
      setLoadingKeys(prev => {
        const n = new Set(prev)
        n.delete(key)
        return n
      })
    }
  }

  const loadFlatDescendants = async (parentId: string) => {
    const key = `flat:${parentId}`
    if (loadingKeys.has(key)) return
    setLoadingKeys(prev => new Set(prev).add(key))
    try {
      const allDescendants: PostComment[] = []
      const queue: string[] = [parentId]
      const fetched = new Set([parentId])

      while (queue.length > 0) {
        const currentId = queue.shift()!
        let page = 1
        let hasMore = true

        while (hasMore) {
          const result = (await fetcher(
            `/api/posts/${postId}/comments?parentId=${currentId}&skip=${(page - 1) * PAGE_SIZE}&take=${PAGE_SIZE}`,
          )) as { data: PostComment[]; total: number }
          allDescendants.push(...result.data)
          if (result.data.length < PAGE_SIZE || result.data.length >= result.total) {
            hasMore = false
          } else {
            page++
          }
        }

        const children = allDescendants.filter(c => c.parentId === currentId)
        for (const child of children) {
          if (!fetched.has(child.id) && ((child as CommentWithCounts)._count?.replies ?? 0) > 0) {
            queue.push(child.id)
            fetched.add(child.id)
          }
        }
      }

      const descendantsWithPreview = await fetchPreviewReplies(allDescendants)
      setChildStates(prev => {
        const next = new Map(prev)
        const existing = next.get(parentId)
        next.set(parentId, {
          comments: descendantsWithPreview,
          total: descendantsWithPreview.length,
          collapsed: false,
          currentPage: 1,
          previewComments: existing?.previewComments,
        })
        return next
      })
    } catch (err) {
      console.error('Failed to load flat descendants', err)
    } finally {
      setLoadingKeys(prev => {
        const n = new Set(prev)
        n.delete(key)
        return n
      })
    }
  }

  const toggleCollapse = (parentId: string) => {
    setChildStates(prev => {
      const next = new Map(prev)
      const existing = next.get(parentId)
      if (existing) {
        next.set(parentId, { ...existing, collapsed: !existing.collapsed })
      }
      return next
    })
  }

  const setChildPage = (parentId: string, page: number) => {
    setChildStates(prev => {
      const next = new Map(prev)
      const existing = next.get(parentId)
      if (existing) {
        next.set(parentId, { ...existing, currentPage: page })
      }
      return next
    })
  }

  const getAllComments = useCallback((): PostComment[] => {
    const all: PostComment[] = []
    for (const [, data] of rootPages) {
      all.push(...data.comments)
    }
    for (const [, state] of childStates) {
      all.push(...state.comments)
    }
    return all
  }, [rootPages, childStates])

  const authorMap = useMemo(() => {
    const map = new Map<string, string>()
    getAllComments().forEach(c => {
      map.set(c.id, c.author?.username || 'Unknown')
    })
    return map
  }, [getAllComments])

  const getReplyToUsername = (comment: PostComment): string | null => {
    if (!comment.parentId) return null
    return authorMap.get(comment.parentId) || null
  }

  const handlePreSubmit = () => {
    if (!newComment.trim()) return
    setShowCaptcha(true)
  }

  const incrementReplyCount = (comment: PostComment): PostComment => ({
    ...comment,
    _count: {
      ...comment._count,
      replies: (comment._count?.replies ?? 0) + 1,
    },
  })

  const appendCreatedComment = (comment: PostComment, parentId?: string | null) => {
    if (!parentId) {
      setRootPages(prev => {
        const next = new Map(prev)
        const pageData = next.get(1)
        if (pageData) {
          next.set(1, {
            ...pageData,
            comments: [...pageData.comments, comment],
            total: pageData.total + 1,
          })
        } else {
          next.set(1, { comments: [comment], total: 1 })
        }
        return next
      })
      setRootPage(1)
      return
    }

    setRootPages(prev => {
      const next = new Map(prev)
      for (const [page, data] of next) {
        next.set(page, {
          ...data,
          comments: data.comments.map(item => item.id === parentId ? incrementReplyCount(item) : item),
        })
      }
      return next
    })

    setChildStates(prev => {
      const next = new Map(prev)
      for (const [stateParentId, state] of next) {
        next.set(stateParentId, {
          ...state,
          comments: state.comments.map(item => item.id === parentId ? incrementReplyCount(item) : item),
        })
      }

      const parentState = next.get(parentId)
      if (parentState) {
        next.set(parentId, {
          ...parentState,
          comments: [...parentState.comments, comment],
          total: parentState.total + 1,
          collapsed: false,
        })
      } else {
        next.set(parentId, {
          comments: [],
          total: 1,
          collapsed: true,
          currentPage: 1,
          previewComments: [comment],
        })
      }

      return next
    })
  }

  const handleSubmit = async (captchaId: string) => {
    setShowCaptcha(false)
    setLoading(true)
    try {
      const data = await fetcher(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ content: newComment, parentId: replyTo?.id, captchaId }),
      })

      if (data.message === 'ERR_PENDING_MODERATION') {
        toast(
          dict.apiErrors?.ERR_PENDING_MODERATION ||
            'Your content contains moderated words and has been submitted for manual review.',
          'info',
        )
        setNewComment('')
        setReplyTo(null)
        return
      }

      const createdComment = (data.comment ?? data) as PostComment
      appendCreatedComment(createdComment, replyTo?.id ?? null)
      setCount(prev => prev + 1)
      setNewComment('')
      setReplyTo(null)
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Failed to post comment'
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>
      toast(apiErrors?.[msg] || msg || apiErrors?.ERR_FAILED_TO_POST_COMMENT || 'Failed to post comment', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = (parentId: string) => {
    const allComments = getAllComments()
    const parentComment = allComments.find(c => c.id === parentId)
    if (parentComment) {
      setReplyTo({ id: parentId, username: parentComment.author?.username || 'Unknown' })
      document.getElementById('comment-input-area')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(dict.post?.confirmDeleteComment || 'Are you sure you want to delete this comment?')) return
    try {
      await fetcher(`/api/posts/comments/${commentId}`, { method: 'DELETE' })
      const deletedAt = new Date().toISOString()
      setRootPages(prev => {
        const next = new Map(prev)
        for (const [page, data] of next) {
          next.set(page, { ...data, comments: data.comments.map(c => (c.id === commentId ? { ...c, deletedAt } : c)) })
        }
        return next
      })
      setChildStates(prev => {
        const next = new Map(prev)
        for (const [parentId, state] of next) {
          next.set(parentId, { ...state, comments: state.comments.map(c => (c.id === commentId ? { ...c, deletedAt } : c)) })
        }
        return next
      })
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Failed to delete comment'
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>
      toast(apiErrors?.[msg] || msg || apiErrors?.ERR_FAILED_TO_DELETE_COMMENT || 'Failed to delete comment', 'error')
    }
  }

  const renderPagination = (currentPg: number, totalPg: number, onPageChange: (p: number) => void) => {
    if (totalPg <= 1) return null
    return (
      <div className="flex items-center justify-center gap-1 mt-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPg - 1))}
          disabled={currentPg <= 1}
          className="px-2 py-0.5 text-xs rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        {Array.from({ length: totalPg }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-2 py-0.5 text-xs rounded border border-border hover:bg-accent ${p === currentPg ? 'bg-primary text-primary-foreground border-primary' : ''}`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPg, currentPg + 1))}
          disabled={currentPg >= totalPg}
          className="px-2 py-0.5 text-xs rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>
    )
  }

  const renderCommentNode = (node: PostComment, depth: number) => {
    const replyToUsername = getReplyToUsername(node)
    const replyCount = (node as CommentWithCounts)._count?.replies ?? 0
    const childState = childStates.get(node.id)
    const isLoaded = childState !== undefined
    const isLoading = loadingKeys.has(`children:${node.id}`) || loadingKeys.has(`flat:${node.id}`)
    const isCollapsed = childState?.collapsed ?? false

    const commentItem = (
      <CommentItem
        comment={node}
        dict={dict}
        onReply={handleReply}
        onDelete={() => handleDeleteComment(node.id)}
        currentUser={currentUser}
        replyToUsername={replyToUsername}
      />
    )

    if (depth >= MAX_DEPTH) {
      return <div key={node.id} className="mt-3">{commentItem}</div>
    }

    if (depth === MAX_DEPTH - 1) {
      const flatComments = childState?.comments ?? []
      const flatTotal = childState?.total ?? 0
      const currentPage = childState?.currentPage ?? 1
      const totalPages = Math.ceil(flatTotal / PAGE_SIZE)
      const pageStart = (currentPage - 1) * PAGE_SIZE
      const pageComments = flatComments.slice(pageStart, pageStart + PAGE_SIZE)
      const storedPreviewComments = childState?.previewComments
      const previewComments = isLoaded
        ? flatComments.slice(0, PREVIEW_COUNT)
        : (storedPreviewComments ?? node.previewReplies ?? [])

      return (
        <div key={node.id} className="mt-3">
          {commentItem}

          {!isLoaded && replyCount > 0 && (
            <div className="ml-8 sm:ml-12 mt-2 space-y-2">
              {previewComments.length > 0 && (
                <div className="space-y-2">
                  {previewComments.map(child => (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted/20 border border-border/50"
                    >
                      <Avatar src={child.author?.avatarUrl} username={child.author?.username || '?'} size={20} />
                      <span className="font-medium text-foreground text-xs">{child.author?.username}</span>
                      {child.parentId && (
                        <span className="text-xs font-semibold text-blue-400">@{authorMap.get(child.parentId) || ''}</span>
                      )}
                      <span className="text-xs text-muted truncate flex-1">{child.content}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => loadFlatDescendants(node.id)}
                disabled={isLoading}
                className="text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded px-2 py-0.5"
              >
                {isLoading ? 'Loading...' : `查看回复 (${replyCount})`}
              </button>
            </div>
          )}

          {isLoaded && (
            <div className="ml-8 sm:ml-12 mt-2 space-y-3">
              {!isCollapsed && pageComments.length > 0 && (
                <div className="space-y-3">
                  {pageComments.map(child => (
                    <div key={child.id}>
                      <CommentItem
                        comment={child}
                        dict={dict}
                        onReply={handleReply}
                        onDelete={() => handleDeleteComment(child.id)}
                        currentUser={currentUser}
                        replyToUsername={authorMap.get(child.parentId ?? '') || null}
                      />
                    </div>
                  ))}
                </div>
              )}

              {isCollapsed && previewComments.length > 0 && (
                <div className="space-y-2">
                  {previewComments.map(child => (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted/20 border border-border/50"
                    >
                      <Avatar src={child.author?.avatarUrl} username={child.author?.username || '?'} size={20} />
                      <span className="font-medium text-foreground text-xs">{child.author?.username}</span>
                      {child.parentId && (
                        <span className="text-xs font-semibold text-blue-400">@{authorMap.get(child.parentId) || ''}</span>
                      )}
                      <span className="text-xs text-muted truncate flex-1">{child.content}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleCollapse(node.id)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded px-2 py-0.5"
                >
                  {isCollapsed ? '查看回复' : '收起回复'}
                </button>
                {flatTotal > PAGE_SIZE && !isCollapsed && (
                  <span className="text-xs text-muted-foreground">
                    {currentPage}/{totalPages} 页
                  </span>
                )}
              </div>

              {!isCollapsed && renderPagination(currentPage, totalPages, p => setChildPage(node.id, p))}
            </div>
          )}
        </div>
      )
    }

    const directChildren = childState?.comments ?? []
    const storedPreviewChildren = childState?.previewComments
    const previewChildren = isLoaded
      ? directChildren.slice(0, PREVIEW_COUNT)
      : (storedPreviewChildren ?? node.previewReplies ?? [])

    return (
      <div key={node.id} className="mt-4">
        {commentItem}

        {!isLoaded && replyCount > 0 && (
          <div className="ml-8 sm:ml-12 mt-2 space-y-2">
            {previewChildren.length > 0 && (
              <div className="space-y-2">
                {previewChildren.map(child => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted/20 border border-border/50"
                  >
                    <Avatar src={child.author?.avatarUrl} username={child.author?.username || '?'} size={20} />
                    <span className="font-medium text-foreground text-xs">{child.author?.username}</span>
                    <span className="text-xs text-muted truncate flex-1">{child.content}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex">
              <div className="w-10 flex-shrink-0 flex justify-end">
                <div className="w-px bg-slate-400" />
              </div>
              <div className="flex-1 min-w-0 pl-4">
                <button
                  onClick={() => loadDirectChildren(node.id)}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded px-2 py-0.5"
                >
                  {isLoading ? 'Loading...' : `查看回复 (${replyCount})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoaded && (
          <div className="ml-8 sm:ml-12 mt-2 space-y-2">
            {!isCollapsed &&
              directChildren.map(child => (
                <div key={child.id}>
                  <div className="flex">
                    <div className="w-10 flex-shrink-0 flex justify-end">
                      <div className="w-px bg-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0 pl-4">{renderCommentNode(child, depth + 1)}</div>
                  </div>
                </div>
              ))}

            {isCollapsed && directChildren.length > 0 && (
              <div className="space-y-2">
                {previewChildren.map(child => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted/20 border border-border/50"
                  >
                    <Avatar src={child.author?.avatarUrl} username={child.author?.username || '?'} size={20} />
                    <span className="font-medium text-foreground text-xs">{child.author?.username}</span>
                    <span className="text-xs text-muted truncate flex-1">{child.content}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleCollapse(node.id)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded px-2 py-0.5"
              >
                {isCollapsed ? '查看回复' : '收起回复'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const rootPageData = rootPages.get(rootPage)
  const rootComments = rootPageData?.comments ?? []
  const rootTotal = rootPageData?.total ?? 0
  const isRootLoading = loadingKeys.has(`root:${rootPage}`)
  const rootTotalPages = Math.ceil(rootTotal / PAGE_SIZE)

  const handleRootPageChange = (page: number) => {
    setRootPage(page)
    if (!rootPages.has(page)) {
      loadRootPage(page)
    }
  }

  return (
    <div className="space-y-4" id="comment-input-area">
      <h3 className="text-lg font-bold text-foreground mb-4">
        {dict.post?.comments || 'Comments'} ({count})
      </h3>

      {showCaptcha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-xl relative">
            <button onClick={() => setShowCaptcha(false)} className="absolute top-2 right-2 text-muted hover:text-foreground">
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">
              {dict.post?.verifyToPostComment || 'Verify to Post Comment'}
            </h3>
            <SliderCaptcha onSuccess={handleSubmit} apiUrl={`/api/v1/auth`} />
          </div>
        </div>
      )}

      <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50 flex gap-4 flex-col">
        {replyTo && (
          <div className="flex items-center justify-between text-sm text-muted bg-background p-2 rounded-lg border border-border">
            <span>
              {dict.post?.replyingTo || 'Replying to'}{' '}
              <span className="font-medium text-foreground">{replyTo.username}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="hover:text-foreground">
              {dict.common?.cancel || 'Cancel'}
            </button>
          </div>
        )}
        <div className="flex gap-4">
          <Avatar src={currentUser?.avatarUrl} username={currentUser?.username || '?'} size={32} />
          <div className="flex-1 space-y-3">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y text-foreground"
              placeholder={dict.post?.writeComment || 'Write a comment...'}
            ></textarea>
            <div className="flex justify-end">
              <button
                onClick={handlePreSubmit}
                disabled={loading || !newComment.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? '...' : dict.post?.postComment || 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {rootTotal === 0 && !isRootLoading ? (
        <div className="text-center text-muted py-4">No comments yet. Be the first to comment!</div>
      ) : (
        <div className="space-y-0">
          {rootComments
            .filter(c => !c.parentId)
            .map(rootNode => renderCommentNode(rootNode, 0))}
          {isRootLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
          {renderPagination(rootPage, rootTotalPages, handleRootPageChange)}
        </div>
      )}
    </div>
  )
}
