// Narrow static guard: YAML duplicate keys and Docker-socket ownership. No Docker needed.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const yaml = require('../../node_modules/.pnpm/node_modules/js-yaml')
const root = path.resolve(__dirname, '../..')
for (const name of ['docker-compose.yml', 'docker-compose.rolling.example.yml', '.github/workflows/docker-publish.yml', '.github/workflows/hot-release.yml']) {
  const value = yaml.load(fs.readFileSync(path.join(root,name),'utf8'))
  if (value.services) for (const [service,settings] of Object.entries(value.services)) {
    const serialized=JSON.stringify(settings)
    if (serialized.includes('/var/run/docker.sock')) assert.equal(service,'plugin-control')
    if (service.startsWith('backend')) assert.ok(!serialized.includes('plugin-runtime'))
  }
}
console.log('PASS: 4 YAML files parsed without duplicate keys; socket only belongs to plugin-control')

// Keep local credentials/one-off host fixtures out of Git and Docker context.
const { execFileSync } = require('node:child_process')
const excluded = ['.codex/private.env.backup', 'ops/plugins/server-test/compose.yml', 'secrets/plugin-control.env', 'signing.pem', 'nested/signing.key', 'reports/private-session.json']
const ignored = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: root, input: excluded.join('\n')+'\n', encoding: 'utf8' }).trim().split(/\r?\n/)
assert.deepEqual(ignored, excluded)
const dockerIgnore = new Set(fs.readFileSync(path.join(root,'.dockerignore'),'utf8').split(/\r?\n/).map(x=>x.trim()))
for (const pattern of ['.codex', '.agents', 'ops/plugins/server-test', 'reports', 'secrets', '**/secrets', '*.pem', '**/*.pem', '*.key', '**/*.key']) assert.ok(dockerIgnore.has(pattern), 'Missing Docker exclusion: '+pattern)
const hot = yaml.load(fs.readFileSync(path.join(root,'.github/workflows/hot-release.yml'),'utf8'))
assert.equal(hot.jobs['deploy-plugin'], undefined)
assert.deepEqual(Object.keys(hot.on), ['workflow_dispatch'])
const deploy = yaml.load(fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8'))
assert.deepEqual(Object.keys(deploy.on), ['workflow_dispatch'])
assert.ok(hot.env.SSH_STAGING_DIR.includes('vars.DEPLOY_STAGING_DIR'))
assert.ok(!JSON.stringify(hot).includes('/home/'))
console.log('PASS: Git/Docker exclusions; explicit-only deployment; portable SSH staging directory')

const baseCompose = yaml.load(fs.readFileSync(path.join(root,'docker-compose.yml'),'utf8'))
for (const service of ['backend','frontend']) assert.ok(baseCompose.services[service].image.startsWith('ghcr.io/kelomina/myndbbs-'+service+':'), 'Core defaults must use CI-published GHCR images')
