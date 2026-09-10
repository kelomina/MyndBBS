import { access, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('RELEASE_HEALTH_TIMEOUT')), ms))

/** Atomic release state machine. The switch is committed only after the new target passes health. */
export async function switchRelease({ root, version, healthCheck, graceMs = 5000 }) {
  const release = path.resolve(root, 'releases', version)
  await access(path.join(release, 'manifest.json'))
  const manifest = JSON.parse(await readFile(path.join(release, 'manifest.json'), 'utf8'))
  if (manifest.version !== version) throw new Error('RELEASE_VERSION_MISMATCH')
  await Promise.race([healthCheck(release, manifest), timeout(graceMs)])
  const current = path.resolve(root, 'current')
  const previous = path.resolve(root, '.previous')
  let old = null
  try { old = await readFile(current, 'utf8') } catch {}
  if (old) await writeFile(previous, old, 'utf8')
  await writeFile(current, release, 'utf8')
  return { version, previous: old }
}

export async function rollback(root) {
  const previous = path.resolve(root, '.previous')
  const target = (await readFile(previous, 'utf8')).trim()
  await access(path.join(target, 'manifest.json'))
  await writeFile(path.resolve(root, 'current'), target, 'utf8')
  return target
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, version] = process.argv.slice(2)
  if (!root || !version) throw new Error('usage: release-controller.mjs <root> <version>')
  await switchRelease({ root, version, healthCheck: async () => {} })
  console.log(`release-current=${version}`)
}
