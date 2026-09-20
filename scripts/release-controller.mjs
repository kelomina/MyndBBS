import { access, lstat, readFile, readlink, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('RELEASE_HEALTH_TIMEOUT')), ms))

async function readPointer(file) {
  try {
    const stat = await lstat(file)
    return stat.isSymbolicLink() ? await readlink(file) : (await readFile(file, 'utf8')).trim()
  } catch {
    return null
  }
}

async function replacePointer(file, target) {
  const temp = `${file}.next-${process.pid}`
  await unlink(temp).catch(() => undefined)
  await writeFile(temp, `${target}\n`, 'utf8')
  await rename(temp, file)
}

/** Atomic release state machine. The switch is committed only after the new target passes health. */
export async function switchRelease({ root, version, healthCheck, graceMs = 5000 }) {
  const release = path.resolve(root, 'releases', version)
  await access(path.join(release, 'manifest.json'))
  const manifest = JSON.parse(await readFile(path.join(release, 'manifest.json'), 'utf8'))
  if (manifest.version !== version) throw new Error('RELEASE_VERSION_MISMATCH')
  await Promise.race([healthCheck(release, manifest), timeout(graceMs)])
  const current = path.resolve(root, 'current')
  const previous = path.resolve(root, '.previous')
  const old = await readPointer(current)
  if (old) await replacePointer(previous, old)
  await replacePointer(current, release)
  return { version, previous: old }
}

export async function rollback(root) {
  const previous = path.resolve(root, '.previous')
  const target = await readPointer(previous)
  if (!target) throw new Error('ERR_RELEASE_PREVIOUS_MISSING')
  await access(path.join(target, 'manifest.json'))
  await replacePointer(path.resolve(root, 'current'), target)
  return target
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, version] = process.argv.slice(2)
  if (!root || !version) throw new Error('usage: release-controller.mjs <root> <version>')
  await switchRelease({ root, version, healthCheck: async () => {} })
  console.log(`release-current=${version}`)
}
