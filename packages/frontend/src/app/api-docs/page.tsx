import type { Metadata } from 'next';
import { OPEN_API_DOCS, type ApiDocEndpoint } from './openapi-data';

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'Public REST API reference for MyndBBS.',
};

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const AUTH_LABELS: Record<string, string> = {
  none: 'Public',
  session: 'Session cookie (logged-in user)',
  admin: 'Admin only',
  'super-admin': 'Super admin only',
};

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">MyndBBS REST API</h1>
      <p className="mt-2 text-sm text-muted">
        Public read endpoints require no authentication. Write endpoints use the
        session cookie issued at login (same-origin browser calls automatically
        carry it; external clients must send the <code className="rounded bg-muted px-1">X-Requested-With: XMLHttpRequest</code> header).
        Sensitive write endpoints additionally enforce CSRF origin checks and
        rate limits. This page is informational; field names follow the camelCase
        JSON shapes shown.
      </p>

      <div className="mt-8 space-y-10">
        {OPEN_API_DOCS.map((group) => (
          <section key={group.group}>
            <h2 className="mb-3 text-xl font-semibold text-foreground">{group.group}</h2>
            <div className="space-y-4">
              {group.endpoints.map((ep: ApiDocEndpoint) => (
                <div key={`${ep.method}-${ep.path}`} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold ${METHOD_STYLES[ep.method] ?? ''}`}
                    >
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm text-foreground">{ep.path}</code>
                  </div>
                  <p className="mt-2 text-sm text-muted">{ep.summary}</p>

                  {ep.params && ep.params.length > 0 && (
                    <table className="mt-3 w-full text-left text-xs">
                      <thead className="text-muted">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Parameter</th>
                          <th className="py-1 pr-3 font-medium">In</th>
                          <th className="py-1 pr-3 font-medium">Type</th>
                          <th className="py-1 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map((p) => (
                          <tr key={p.name} className="border-t border-border/60">
                            <td className="py-1.5 pr-3 font-mono">
                              {p.name}
                              {p.required && <span className="text-red-500"> *</span>}
                            </td>
                            <td className="py-1.5 pr-3 text-muted">{p.location}</td>
                            <td className="py-1.5 pr-3 font-mono text-muted">{p.type}</td>
                            <td className="py-1.5 text-muted">{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <p className="mt-2 text-xs text-muted">Auth: {AUTH_LABELS[ep.auth] ?? ep.auth}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted">
        Errors are returned as <code className="rounded bg-muted px-1">{`{ "error": "ERR_CODE" }`}</code>{' '}
        with an appropriate HTTP status. Rate limits apply per IP on auth,
        posting and upload routes.
      </p>
    </main>
  );
}
