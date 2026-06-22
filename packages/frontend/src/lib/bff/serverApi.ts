import { buildBackendUrl } from './backend'

export function serverApiUrl(path: string): string {
  return buildBackendUrl(path)
}
