const DEFAULT_MESSAGE_PAGE_LIMIT = 20;
const MAX_MESSAGE_PAGE_LIMIT = 100;

/**
 * Function name:
 *   parseMessagePageLimit
 *
 * Purpose:
 *   Parses and validates the inbox page-size query parameter before it reaches the
 *   messaging query service, preventing unbounded database reads.
 *
 * Called by:
 *   getInbox; indirectly by GET /api/v1/messages/inbox.
 *
 * Calls:
 *   Number.
 *
 * Parameters:
 *   - rawLimit: unknown, Express query value for limit; undefined uses the default.
 *
 * Returns:
 *   number | null. Returns a safe limit in 1..100, or null for invalid input.
 *
 * Error handling:
 *   Does not throw; callers map null to ERR_INVALID_MESSAGE_PAGE_LIMIT.
 *
 * Side effects:
 *   None.
 *
 * Transaction boundary:
 *   None.
 *
 * Concurrency and idempotency:
 *   Pure and repeatable.
 *
 * English keywords:
 *   message, inbox, pagination, limit, validate, dos, query, controller, page, cursor
 */
export const parseMessagePageLimit = (rawLimit: unknown): number | null => {
  if (rawLimit === undefined) {
    return DEFAULT_MESSAGE_PAGE_LIMIT;
  }

  if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) {
    return null;
  }

  const parsedLimit = Number(rawLimit);
  if (parsedLimit < 1 || parsedLimit > MAX_MESSAGE_PAGE_LIMIT) {
    return null;
  }

  return parsedLimit;
};
