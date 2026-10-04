// Targeted, offline packaging smoke; no services, Docker, network, or real keys.
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify, createHash } from 'node:crypto'
import { cp, lstat, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { packageRelease } from '../../scripts/package-plugin-release.mjs'
import { verifyArchive } from '../../scripts/plugin-archive.mjs'
import { signingPayload } from '../../scripts/plugin-v2.mjs'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const temporary = await mkdtemp(path.join(os.tmpdir(), 'myndbbs-plugin-package-smoke-'))
const source = path.join(temporary, 'source')
await cp(path.join(repo, 'ops/plugins/example'), source, { recursive: true })
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const publicPem = publicKey.export({ type: 'spki', format: 'pem' })
const options = { source, out: path.join(temporary, 'one'), keyPem, keyId: 'local-example-2026', id: 'example-counter', version: '1.0.0' }
const first = await packageRelease(options)
const archivePath = path.join(first.out, first.filename)
const archive = await readFile(archivePath)
const signature = await readFile(archivePath + '.sig')
assert.equal(signature.length, 64)
assert.equal(first.signatureBytes, 64)
const digest = createHash('sha256').update(archive).digest('hex')
assert.equal(await readFile(archivePath + '.sha256', 'utf8'), `${digest}  ${first.filename}
`)
const result = verifyArchive(archive, signature, { keys: { [options.keyId]: publicPem } })
assert.equal(result.files.size, 2)
assert.equal(result.manifest.id, options.id)
// Independent recursive canonical implementation proves exact prefix/LF envelope.
const canonical = value => value !== null && typeof value === 'object'
  ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',')}}`
  : JSON.stringify(value)
const payload = Buffer.from(`MYNDBBS_PLUGIN_V2
${digest}
${canonical(result.manifest)}
`, 'utf8')
assert.deepEqual(signingPayload(digest, result.manifest), payload)
assert(verify(null, payload, publicKey, signature))
assert(!verify(null, Buffer.from(payload.toString().replace(digest, '0'.repeat(64))), publicKey, signature))
const wrongKey = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' })
assert.throws(() => verifyArchive(archive, signature, { keys: { [options.keyId]: wrongKey } }), /ERR_PLUGIN_SIGNATURE_INVALID/)
assert.throws(() => verifyArchive(archive, signature, { keys: {} }), /ERR_PLUGIN_SIGNATURE_KEY_NOT_TRUSTED/)
assert.throws(() => verifyArchive(archive, signature.subarray(0, 63), { keys: { [options.keyId]: publicPem } }), /ERR_PLUGIN_SIGNATURE_INVALID/)
const second = await packageRelease({ ...options, out: path.join(temporary, 'two') })
assert.deepEqual(archive, await readFile(path.join(second.out, second.filename)))
assert.deepEqual(signature, await readFile(path.join(second.out, second.filename + '.sig')))
for (const type of ['rsa', 'ed448']) {
  const bad = generateKeyPairSync(type, type === 'rsa' ? { modulusLength: 2048 } : {}).privateKey.export({ type: 'pkcs8', format: 'pem' })
  await assert.rejects(packageRelease({ ...options, keyPem: bad }), /ERR_PACKAGE_ED25519_REQUIRED/)
}
await assert.rejects(packageRelease(options), /ERR_PACKAGE_OUTPUT_EXISTS/)
await assert.rejects(packageRelease({ ...options, keyId: 'wrong-key-id' }), /ERR_PACKAGE_IDENTITY_MISMATCH/)
await assert.rejects(packageRelease({ ...options, out: path.join(source, 'output') }), /ERR_PACKAGE_OUTPUT_IN_SOURCE/)
await writeFile(path.join(source, '.env'), 'SMOKE_ONLY=not-a-real-secret\n')
await assert.rejects(packageRelease({ ...options, out: path.join(temporary, 'unsafe') }), /ERR_PACKAGE_UNSAFE_MEMBER/)
// The fixture copy is intentionally retained in OS temp; no recursive deletion.
const clean = path.join(temporary, 'tampered')
await cp(path.join(repo, 'ops/plugins/example'), clean, { recursive: true })
await writeFile(path.join(clean, 'entry.mjs'), 'export default {}\n')
await assert.rejects(packageRelease({ ...options, source: clean }), /ERR_PACKAGE_ENTRY_HASH/)
const cli = spawnSync(process.execPath, ['scripts/package-plugin-release.mjs', '--source', 'ops/plugins/example', '--out', path.join(temporary, 'cli'), '--key-id', options.keyId], {
  cwd: repo, encoding: 'utf8', env: { ...process.env, PLUGIN_SIGNING_KEY: keyPem },
})
assert.equal(cli.status, 0, cli.stderr)
const record = JSON.parse(cli.stdout)
assert.equal(record.signatureBytes, 64)
assert.equal(record.sha256, digest)
assert(!cli.stdout.includes('PRIVATE KEY'))
for (const suffix of ['', '.sig', '.sha256']) assert((await lstat(path.join(record.out, record.filename + suffix))).size > 0)
const module = await import(new URL('./example/entry.mjs', import.meta.url))
await module.default.activate({ registerHealthCheck: fn => fn() })
assert.deepEqual((await module.default.handle()).body, { ok: true, value: 42 })
console.log(JSON.stringify({ status: 'PASS', checks: ['archive+entry', 'binary-signature-64', 'exact-envelope', 'digest-tamper-rejected', 'wrong-and-unknown-key-rejected', 'short-signature-rejected', 'deterministic-rebuild', 'rsa-ed448-rejected', 'output-overwrite-rejected', 'key-id-mismatch-rejected', 'output-in-source-rejected', 'secret-file-rejected', 'entry-tamper-rejected', 'CLI-three-nonempty-files', 'example-value-42'], files: result.files.size, signatureBytes: signature.length, exampleValue: 42, temporary }))
