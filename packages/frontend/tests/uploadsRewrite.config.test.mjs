import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const nextConfigPath = new URL('../next.config.ts', import.meta.url)

test('Next.js rewrites uploaded files to backend storage service', async () => {
  const source = await fs.readFile(nextConfigPath, 'utf8')

  assert.match(source, /source:\s*'\/uploads\/:path\*'/)
  assert.match(source, /destination:\s*`\$\{apiBaseUrl\}\/uploads\/:path\*`/)
})
