import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const [, , releaseDir, version] = process.argv
if (!releaseDir || !version) throw new Error('usage: frontend-release-manifest.mjs <release-dir> <version>')
const payload = await readFile(`${releaseDir}/server.js`)
const manifest = { version, artifact: 'next-standalone', sha256: createHash('sha256').update(payload).digest('hex') }
await writeFile(`${releaseDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(manifest))
