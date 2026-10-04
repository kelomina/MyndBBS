// Real Next proxy + catch-all decoding + BFF HTTP, with a synthetic backend only.
// Run explicitly: node tests/plugin-csp.http.smoke.mjs (not a browser/production test).
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
// Keep the fixture on the dependency drive: Next/Webpack cannot resolve cross-drive relative entries on Windows.
const fixtureBase = path.resolve(root, '../../reports/plugin-csp-fixtures')
await fs.mkdir(fixtureBase, { recursive: true })
const fixture = await fs.mkdtemp(path.join(fixtureBase, 'run-'))
const sources = ['src/proxy.ts', 'src/middleware', 'src/i18n/config.ts', 'src/lib/routingGuard.ts', 'src/lib/bff', 'src/app/api/[...path]/route.ts']
for (const name of sources) {
  await fs.mkdir(path.dirname(path.join(fixture, name)), { recursive: true })
  await fs.cp(path.join(root, name), path.join(fixture, name), { recursive: true })
}
await fs.symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
await fs.writeFile(path.join(fixture, 'package.json'), JSON.stringify({ private: true }))
await fs.copyFile(path.join(root, 'tsconfig.json'), path.join(fixture, 'tsconfig.json'))
await fs.writeFile(path.join(fixture, 'src/app/layout.tsx'), 'export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}')
await fs.writeFile(path.join(fixture, 'src/app/page.tsx'), 'export default function Page(){return <p>core page</p>}')
const upstreamPaths = []
const backend = http.createServer((req, res) => {
  upstreamPaths.push(req.url)
  if (/^\/api\/human-verification\/ui\/?$/i.test(req.url)) {
    res.writeHead(200, {'content-type':'text/html','set-cookie':'must_not_leak=1','content-security-policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'"}); res.end('<!doctype html><output>neutral</output>')
  } else if (/^\/api\/plugins\/demo\/__ui\/ui\/sidebar\.html$/i.test(req.url)) {
    res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "sandbox allow-scripts; default-src 'none'; connect-src 'none'; form-action 'none'" })
    res.end('<!doctype html><output>42</output>')
  } else if (req.url === '/api/public/install-status') {
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"setupRequired":false}')
  } else { res.writeHead(404); res.end('Not found') }
})
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
await listen(backend)
process.env.API_URL = 'http://127.0.0.1:' + backend.address().port
process.env.NODE_ENV = 'development'
process.env.NEXT_TELEMETRY_DISABLED = '1'
const next = require('next')
const app = next({ dev: true, webpack: true, dir: fixture, hostname: '127.0.0.1', conf: { poweredByHeader: false } })
let frontend
let exitCode = 0
const deadline = setTimeout(() => { console.error('HTTP smoke deadline exceeded'); process.exit(1) }, 120000)
deadline.unref()
try {
  await app.prepare()
  frontend = http.createServer(app.getRequestHandler())
  await listen(frontend)
  const base = 'http://127.0.0.1:' + frontend.address().port
  const variants = [
    '/api/plugins/demo/__ui/ui/sidebar.html',
    '/api/plugins/demo/%5f%5fui/ui/sidebar.html',
    '/api/plugins/demo/%5F_ui/ui/sidebar.html',
    '/api/%70lugins/demo/__ui/ui/sidebar.html',
    '/api/%70lugins/demo/%5f%5f%75i/ui/sidebar.html',
    '/api/plugins/demo%2f__ui/ui/sidebar.html',
    '/api/unused%2f..%2fplugins/demo/__ui/ui/sidebar.html',
    '/api/unused%2f%252e%252e%2fplugins/demo/__ui/ui/sidebar.html',
    '/api/PLUGINS/demo/__ui/ui/sidebar.html',
  ]
  for (const pathname of variants) {
    const response = await fetch(base + pathname, { redirect: 'manual', signal: AbortSignal.timeout(90000) })
    assert.equal(response.status, 200, pathname)
    assert.equal(await response.text(), '<!doctype html><output>42</output>', pathname)
    const csp = response.headers.get('content-security-policy')
    assert.match(csp, /^sandbox allow-scripts;/, pathname)
    assert.ok(csp.includes("connect-src 'none'") && csp.includes("form-action 'none'"), pathname)
    assert.ok(!csp.includes('allow-same-origin') && !csp.includes('nonce-'), pathname)
  }
  const neutralVariants = ['/api/human-verification/ui','/api/%68uman-verification/%75i','/api/human-verification%2fui','/api/unused%2f..%2fhuman-verification/ui','/api/unused%2f%252e%252e%2fhuman-verification/ui','/api/HUMAN-VERIFICATION/UI']
  for (const pathname of neutralVariants) {
    const response=await fetch(base+pathname,{redirect:'manual',signal:AbortSignal.timeout(90000)})
    assert.equal(response.status,200,pathname)
    assert.equal(await response.text(),'<!doctype html><output>neutral</output>',pathname)
    const csp=response.headers.get('content-security-policy')
    assert.match(csp,/^sandbox allow-scripts;/,pathname)
    assert.ok(csp.includes("script-src 'unsafe-inline'")&&!csp.includes('nonce-')&&!csp.includes('allow-same-origin'),pathname)
    assert.equal(response.headers.get('set-cookie'),null,pathname)
    assert.equal(response.headers.get('cache-control'),'no-store',pathname)
  }
  const near=await fetch(base+'/api/human-verification/ui-extra')
  assert.equal(near.status,404)
  assert.ok(!near.headers.get('content-security-policy').includes('sandbox'))
  const core = await fetch(base + '/', { signal: AbortSignal.timeout(90000) })
  assert.equal(core.status, 200)
  assert.ok(!core.headers.get('content-security-policy').includes('sandbox'))
  console.log(JSON.stringify({ suite: 'real-next-encoded-plugin-csp', ok: true, htmlVariants: variants.length, neutralVariants:neutralVariants.length, corePolicyPreserved: true, source: 'copied unmodified shipping proxy/BFF modules', backend: 'synthetic HTML fixture', browser: false, upstreamRequests: upstreamPaths.length }))
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  frontend?.closeAllConnections()
  if (frontend) await new Promise(resolve => frontend.close(resolve))
  await app.close()
  backend.closeAllConnections()
  await new Promise(resolve => backend.close(resolve))
}

clearTimeout(deadline)
// Standalone smoke owns the dev server; Next may keep dev watchers after close().
process.exit(exitCode)
