import { validatePluginManifest } from '../src/infrastructure/plugins/PluginManifest'

const valid = { id: 'demo', version: '1.0.0', apiVersion: 1, entry: 'index.cjs', sha256: 'a'.repeat(64) }

describe('plugin manifest validation', () => {
  test('accepts a valid relative entry', () => expect(() => validatePluginManifest(valid)).not.toThrow())
  test.each([null, [], {}, { ...valid, sha256: 'bad' }, { ...valid, apiVersion: 2 }])('rejects malformed manifest %#', value => {
    expect(() => validatePluginManifest(value)).toThrow('ERR_INVALID_PLUGIN_MANIFEST')
  })
  test.each(['/tmp/plugin.cjs', 'C:\\plugin.cjs', '../plugin.cjs', 'a/../plugin.cjs', 'a\\plugin.cjs', '', './plugin.cjs', 'a//plugin.cjs', 'file:plugin.cjs'])('rejects unsafe entry %s', entry => {
    expect(() => validatePluginManifest({ ...valid, entry })).toThrow('ERR_INVALID_PLUGIN_ENTRY')
  })
})
