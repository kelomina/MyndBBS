/** Match the URL that the catch-all BFF actually forwards: decode once, then URL-normalize. */
export function normalizedBffPath(pathname: string): string | null {
  try {
    return new URL(
      'https://isolated.invalid' +
        pathname
          .split('/')
          .map((segment) => decodeURIComponent(segment))
          .join('/'),
    ).pathname
  } catch {
    return null
  }
}
export function isHumanVerificationUiPath(pathname: string): boolean {
  const normalized = normalizedBffPath(pathname)
  return normalized !== null && /^\/api\/human-verification\/ui\/?$/i.test(normalized)
}
