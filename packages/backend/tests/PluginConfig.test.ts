import { generateKeyPairSync, sign } from 'node:crypto'
import {
  encryptPluginSecrets,
  preparePluginConfigUpdate,
  publicPluginConfig,
  resolvedPluginConfig,
  validatePluginConfig,
  validatePluginConfigSchema,
  configForManifest,
} from '../src/infrastructure/plugins/PluginConfig'
import {
  canonicalizeManifest,
  signingPayload,
  verifyDetachedSignature,
} from '../src/infrastructure/plugins/PluginManifest'

describe('plugin v2 config and signing helpers', () => {
  const originalKey = process.env.PLUGIN_CONFIG_ENCRYPTION_KEY
  beforeEach(() => {
    process.env.PLUGIN_CONFIG_ENCRYPTION_KEY = 'a'.repeat(64)
  })
  afterAll(() => {
    if (originalKey === undefined) delete process.env.PLUGIN_CONFIG_ENCRYPTION_KEY
    else process.env.PLUGIN_CONFIG_ENCRYPTION_KEY = originalKey
  })

  test('masks, preserves, and clears nested secrets', () => {
    const first = preparePluginConfigUpdate(
      { endpoint: 'https://example.test', auth: { token: 'one' } },
      ['/auth/token'],
    )
    expect(publicPluginConfig(first.publicConfig, first.encryptedSecrets, ['/auth/token'])).toEqual(
      { endpoint: 'https://example.test', auth: { token: '********' } },
    )
    const retained = preparePluginConfigUpdate(
      { endpoint: 'https://new.example.test', auth: {} },
      ['/auth/token'],
      first.encryptedSecrets,
    )
    expect(resolvedPluginConfig(retained.publicConfig, retained.encryptedSecrets)).toEqual({
      endpoint: 'https://new.example.test',
      auth: { token: 'one' },
    })
    const cleared = preparePluginConfigUpdate(
      { endpoint: 'https://new.example.test', auth: { token: null } },
      ['/auth/token'],
      retained.encryptedSecrets,
    )
    expect(
      publicPluginConfig(cleared.publicConfig, cleared.encryptedSecrets, ['/auth/token']),
    ).toEqual({ endpoint: 'https://new.example.test', auth: {} })
  })

  test('does not need an encryption key when manifest declares no secrets', () => {
    delete process.env.PLUGIN_CONFIG_ENCRYPTION_KEY
    expect(preparePluginConfigUpdate({ enabled: true }, [])).toEqual({
      publicConfig: { enabled: true },
      encryptedSecrets: '',
    })
  })

  test('rejects unsupported schema references', () => {
    expect(() =>
      validatePluginConfig(
        { value: 'x' },
        { type: 'object', properties: { value: { $ref: 'https://example.test/schema' } } },
      ),
    ).toThrow('ERR_INVALID_PLUGIN_CONFIG')
  })

  test('mask preserves and version change strips old secret before public projection', () => {
    const first = preparePluginConfigUpdate({ token: 'secret', endpoint: 'ok' }, ['/token'])
    const masked = preparePluginConfigUpdate(
      { token: '********', endpoint: 'next' },
      ['/token'],
      first.encryptedSecrets,
    )
    expect(resolvedPluginConfig(masked.publicConfig, masked.encryptedSecrets)).toEqual({
      token: 'secret',
      endpoint: 'next',
    })
    const next = configForManifest(
      { ...first.publicConfig, token: 'legacy-plaintext' },
      first.encryptedSecrets,
      ['/token'],
      [],
    )
    expect(resolvedPluginConfig(next.publicConfig, next.encryptedSecrets)).toEqual({
      endpoint: 'ok',
    })
  })

  test('rejects prototype keys, unsafe/overlapping pointers and arrays', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(() =>
        preparePluginConfigUpdate(JSON.parse('{"' + key + '": {"polluted":true}}'), []),
      ).toThrow('ERR_INVALID_PLUGIN_CONFIG')
      expect(() => preparePluginConfigUpdate({}, ['/' + key + '/polluted'])).toThrow(
        'ERR_INVALID_PLUGIN_SECRET_PATH',
      )
    }
    expect(() => preparePluginConfigUpdate({}, ['/auth', '/auth/token'])).toThrow(
      'ERR_INVALID_PLUGIN_SECRET_PATH',
    )
    expect(() => preparePluginConfigUpdate({}, ['/bad~2path'])).toThrow(
      'ERR_INVALID_PLUGIN_SECRET_PATH',
    )
    expect(() => preparePluginConfigUpdate({ tokens: ['secret'] }, ['/tokens/0'])).toThrow(
      'ERR_INVALID_PLUGIN_SECRET_PATH',
    )
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  test('requires explicit types and rejects unsupported dialect even in absent properties', () => {
    const schema = { type: 'object', properties: { token: { type: 'string' } } }
    expect(() => validatePluginConfigSchema(schema, ['/token'])).not.toThrow()
    for (const keyword of ['pattern', 'allOf', '$ref', 'unknown']) {
      expect(() =>
        validatePluginConfig(
          {},
          { type: 'object', properties: { missing: { type: 'string', [keyword]: 'bad' } } },
        ),
      ).toThrow('ERR_INVALID_PLUGIN_CONFIG')
    }
    expect(() => validatePluginConfigSchema({ properties: {} })).toThrow(
      'ERR_INVALID_PLUGIN_CONFIG',
    )
    expect(() => validatePluginConfigSchema({ type: 'object', properties: { token: {} } })).toThrow(
      'ERR_INVALID_PLUGIN_CONFIG',
    )
    expect(() => validatePluginConfigSchema(schema, ['/absent'])).toThrow(
      'ERR_INVALID_PLUGIN_SECRET_PATH',
    )
    expect(() =>
      validatePluginConfigSchema(
        { type: 'object', properties: { tokens: { type: 'array', items: { type: 'string' } } } },
        ['/tokens'],
      ),
    ).toThrow('ERR_INVALID_PLUGIN_SECRET_PATH')
    expect(() =>
      validatePluginConfigSchema({
        type: 'object',
        properties: JSON.parse('{"__proto__":{"type":"string"}}'),
      }),
    ).toThrow('ERR_INVALID_PLUGIN_CONFIG')
  })

  test('verifies an Ed25519 detached signature over archive hash and canonical manifest', () => {
    const manifest = {
      id: 'demo',
      version: '1.0.0',
      apiVersion: 2 as const,
      entry: 'index.mjs',
      entrySha256: 'a'.repeat(64),
      signatureKeyId: 'release-key-1',
      capabilities: { routes: [], events: [], ui: [] },
    }
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const archiveHash = 'b'.repeat(64)
    const signature = sign(null, signingPayload(archiveHash, manifest), privateKey)
    expect(canonicalizeManifest(manifest)).toContain('"apiVersion":2')
    expect(
      verifyDetachedSignature(
        signature,
        publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        archiveHash,
        manifest,
      ),
    ).toBe(true)
    expect(
      verifyDetachedSignature(
        signature,
        publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        'c'.repeat(64),
        manifest,
      ),
    ).toBe(false)
  })
})
