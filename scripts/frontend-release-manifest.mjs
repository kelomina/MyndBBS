import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [, , releaseDir, version] = process.argv
if (!releaseDir || !version) throw new Error('usage: frontend-release-manifest.mjs <release-dir> <version>')
const server = 'packages/frontend/server.js'
const payload = await readFile(path.join(releaseDir, server))
const manifest = {
  version,
  artifact: 'next-standalone',
  server,
  sha256: createHash('sha256').update(payload).digest('hex'),
}
await writeFile(`${releaseDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(manifest))
