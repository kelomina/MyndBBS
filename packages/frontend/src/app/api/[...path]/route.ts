import type { NextRequest } from 'next/server'
import { proxyToBackend } from '../../../lib/bff/proxy'

type RouteContext = {
  params: Promise<{ path?: string[] }>
}

async function handle(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params
  const path = params.path?.join('/') || ''
  return proxyToBackend(request, `/api/${path}`)
}

export const GET = handle
export const HEAD = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
export const OPTIONS = handle
