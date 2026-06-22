function buildFullUrl(url: string): string {
  if (url.startsWith('/api') || url.startsWith('/uploads')) return url
  const baseUrl = process.env.API_URL || 'http://localhost:3001'
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
  return fetch(buildFullUrl(url), withAuthHeaders(options))
}

export const fetcher = async (url: string, options?: RequestInit) => {
  const res = await fetch(buildFullUrl(url), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options?.headers,
    },
    credentials: 'include',
  })

  if (!res.ok) {
    const fallbackEmptyObject = () => ({})
    const error = await res.json().catch(fallbackEmptyObject)
    throw new Error(error.error || 'Request failed')
  }

  return res.json()
}
