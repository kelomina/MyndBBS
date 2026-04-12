/**
 * Callers: []
 * Callees: [startsWith, fetch, catch, json]
 * Description: Handles the fetcher logic for the application.
 * Keywords: fetcher, auto-annotated
 */
export const fetcher = async (url: string, options?: RequestInit) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const fullUrl = url.startsWith('/api') && typeof window !== 'undefined' ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
/**
 * Callers: [fetcher]
 * Callees: []
 * Description: An anonymous fallback function that returns an empty object if `res.json()` fails to parse the error response.
 * Keywords: fetcher, error, fallback, catch, anonymous
 */
const fallbackEmptyObject = () => ({});
    const error = await res.json().catch(fallbackEmptyObject);
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};
