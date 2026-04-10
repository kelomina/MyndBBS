export const fetcher = async (url: string, options?: RequestInit) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  // Use relative URL for client-side if it starts with /api, otherwise use baseUrl
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
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};
