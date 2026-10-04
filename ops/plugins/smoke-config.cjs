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
