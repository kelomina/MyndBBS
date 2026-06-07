export function getErrorCodeFromUnknown(err: unknown): string {
  const rawCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code
      : undefined;

  if (typeof rawCode === 'string' && (rawCode.startsWith('ERR_') || rawCode.startsWith('LIMIT_'))) {
    return rawCode;
  }

  const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (errorMessage.startsWith('ERR_') || errorMessage.startsWith('LIMIT_')) {
    return errorMessage;
  }

  return 'ERR_INTERNAL_SERVER_ERROR';
}

export function getStatusCodeForErrorCode(errorCode: string): number {
  if (errorCode === 'ERR_CORS_NOT_ALLOWED') {
    return 403;
  }

  if (errorCode === 'LIMIT_FILE_SIZE') {
    return 413;
  }

  if (
    errorCode === 'ERR_FILE_TYPE_NOT_ALLOWED' ||
    errorCode === 'ERR_FILE_CONTENT_TYPE_MISMATCH' ||
    errorCode.startsWith('LIMIT_')
  ) {
    return 400;
  }

  if (errorCode.includes('UNAUTHORIZED')) {
    return 401;
  }

  if (errorCode.includes('FORBIDDEN')) {
    return 403;
  }

  if (errorCode.includes('NOT_FOUND')) {
    return 404;
  }

  if (
    errorCode.includes('BAD_REQUEST') ||
    errorCode.includes('INVALID') ||
    errorCode.includes('MISSING')
  ) {
    return 400;
  }

  return 500;
}
