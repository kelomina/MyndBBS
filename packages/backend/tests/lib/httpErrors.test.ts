import { getErrorCodeFromUnknown, getStatusCodeForErrorCode } from '../../src/lib/httpErrors';

describe('getStatusCodeForErrorCode', () => {
  it('maps rejected CORS origins to forbidden instead of internal server error', () => {
    expect(getStatusCodeForErrorCode('ERR_CORS_NOT_ALLOWED')).toBe(403);
  });

  it.each([
    ['ERR_UNAUTHORIZED', 401],
    ['ERR_FORBIDDEN', 403],
    ['ERR_NOT_FOUND', 404],
    ['ERR_BAD_REQUEST', 400],
    ['ERR_INVALID_INPUT', 400],
    ['ERR_REQUIRED_FIELD_MISSING', 400],
    ['ERR_FILE_TYPE_NOT_ALLOWED', 400],
    ['ERR_FILE_CONTENT_TYPE_MISMATCH', 400],
    ['LIMIT_UNEXPECTED_FILE', 400],
    ['LIMIT_FILE_SIZE', 413],
    ['ERR_INTERNAL_SERVER_ERROR', 500],
  ])('maps %s to %i', (errorCode, statusCode) => {
    expect(getStatusCodeForErrorCode(errorCode)).toBe(statusCode);
  });

  it('uses structured middleware error codes before generic messages', () => {
    const multerLikeError = Object.assign(new Error('File too large'), {
      code: 'LIMIT_FILE_SIZE',
    });

    expect(getErrorCodeFromUnknown(multerLikeError)).toBe('LIMIT_FILE_SIZE');
  });

  it('falls back to internal server error for unstructured errors', () => {
    expect(getErrorCodeFromUnknown(new Error('unexpected failure'))).toBe(
      'ERR_INTERNAL_SERVER_ERROR',
    );
  });
});
