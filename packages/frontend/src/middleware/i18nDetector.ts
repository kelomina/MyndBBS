import type { NextRequest } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './types';

export function detectLocale(_request: NextRequest, ctx: MiddlewareContext): MiddlewareResult {
  void _request;
  void ctx;
  return null;
}
