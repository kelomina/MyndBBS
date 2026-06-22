export function getBackendBaseUrl(): string {
  return process.env.API_URL || 'http://127.0.0.1:3001'
}

export function buildBackendUrl(pathname: string, search = ''): string {
  const baseUrl = getBackendBaseUrl().replace(/\/+$/, '')
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${baseUrl}${path}${search}`
}
