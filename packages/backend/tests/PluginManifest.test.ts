import { validatePluginManifest } from '../src/infrastructure/plugins/PluginManifest'

const valid = {
  id: 'demo',
  version: '1.0.0',
  apiVersion: 2,
  entry: 'index.mjs',
  entrySha256: 'a'.repeat(64),
  signatureKeyId: 'release-key-1',
  capabilities: {
    routes: [{ path: '/echo', methods: ['GET', 'POST'], auth: 'authenticated' }],
    events: [{ name: 'PostApprovedEvent', version: 1 }],
    ui: [{ slot: 'admin.sidebar', path: 'ui/sidebar.html' }],
    config: {
      schema: { type: 'object', properties: { token: { type: 'string' } } },
      secretPaths: ['/token'],
    },
  },
}

describe('plugin manifest validation', () => {
  test('accepts a valid v2 relative entry and capabilities', () =>
    expect(() => validatePluginManifest(valid)).not.toThrow())
  test.each([null, [], {}, { ...valid, entrySha256: 'bad' }, { ...valid, apiVersion: 1 }])(
    'rejects malformed manifest %#',
    (value) => {
      expect(() => validatePluginManifest(value)).toThrow('ERR_INVALID_PLUGIN_MANIFEST')
    },
  )
  test.each([
    '/tmp/plugin.mjs',
    'C:\\plugin.mjs',
    '../plugin.mjs',
    'a/../plugin.mjs',
    'a\\\\plugin.mjs',
    '',
    './plugin.mjs',
    'a//plugin.mjs',
    'file:plugin.mjs',
  ])('rejects unsafe entry %s', (entry) => {
    expect(() => validatePluginManifest({ ...valid, entry })).toThrow('ERR_INVALID_PLUGIN_ENTRY')
  })
  test('rejects missing capability arrays', () =>
    expect(() => validatePluginManifest({ ...valid, capabilities: {} })).toThrow(
      'ERR_INVALID_PLUGIN_CAPABILITIES',
    ))
  test('rejects undeclared or privileged capabilities', () => {
    expect(() =>
      validatePluginManifest({
        ...valid,
        capabilities: { ...valid.capabilities, routes: [{ path: '/x', methods: ['TRACE'] }] },
      }),
    ).toThrow('ERR_INVALID_PLUGIN_ROUTE_CAPABILITY')
    expect(() =>
      validatePluginManifest({
        ...valid,
        capabilities: { ...valid.capabilities, ui: [{ slot: 'core.dom', path: 'x.html' }] },
      }),
    ).toThrow('ERR_INVALID_PLUGIN_UI_CAPABILITY')
  })
})
