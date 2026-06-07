let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
      const ok = res.ok;
      if (ok && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('token-refreshed'));
      }
      return ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function buildFullUrl(url: string): string {
  if (url.startsWith('/api') && typeof window !== 'undefined') return url
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

function withAuthHeaders(options?: RequestInit): RequestInit {
  return {
    ...options,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...options?.headers,
    },
    credentials: 'include',
  }
}

export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const fullUrl = buildFullUrl(url)
  const authOptions = withAuthHeaders(options)

  const res = await fetch(fullUrl, authOptions)

  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      return fetch(fullUrl, authOptions)
    }
  }

  return res
}

export const fetcher = async (url: string, options?: RequestInit) => {
  const fullUrl = buildFullUrl(url)

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options?.headers,
    },
    credentials: 'include',
  })

  if (res.status === 401 && typeof window !== 'undefined') {
    const fallbackEmptyObject = () => ({})
    const errorData = await res.json().catch(fallbackEmptyObject)
    const errorCode = errorData.error

    if (errorCode === 'ERR_INVALID_TOKEN' || errorCode === 'ERR_SESSION_REVOKED_OR_INVALID') {
      const refreshed = await tryRefreshToken()

      if (refreshed) {
        const retryRes = await fetch(fullUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options?.headers,
          },
          credentials: 'include',
        })

        if (retryRes.ok) {
          return retryRes.json()
        }

        const retryError = await retryRes.json().catch(fallbackEmptyObject)
        throw new Error(retryError.error || 'Request failed')
      }
    }

    throw new Error(errorCode || 'ERR_UNAUTHORIZED')
  }

  if (!res.ok) {
    const fallbackEmptyObject = () => ({})
    const error = await res.json().catch(fallbackEmptyObject)
    throw new Error(error.error || 'Request failed')
  }
  return res.json()
}
