import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [, , releaseDir, version] = process.argv
if (!releaseDir || !version) throw new Error('usage: frontend-release-manifest.mjs <release-dir> <version>')
const candidates = ['server.js', 'packages/frontend/server.js']
let server
for (const candidate of candidates) {
  try {
    if ((await stat(path.join(releaseDir, candidate))).isFile()) {
      server = candidate
      break
    }
  } catch {}
}
if (!server) throw new Error('standalone server.js is missing from release')
const payload = await readFile(path.join(releaseDir, server))
const manifest = {
  version,
  artifact: 'next-standalone',
  server,
  sha256: createHash('sha256').update(payload).digest('hex'),
}
await writeFile(`${releaseDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(manifest))
