import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

test('hot release workflow builds on GitHub and deploys only when explicitly requested', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/hot-release.yml'), 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /pnpm --filter frontend build/)
  assert.match(workflow, /inputs\.deploy == true/)
  assert.match(workflow, /appleboy\/scp-action/)
  assert.match(workflow, /ensure-openresty-hot-update\.sh/)
  assert.match(workflow, /install-frontend-release\.sh/)
  assert.match(workflow, /path: frontend-artifact/)
  assert.match(workflow, /ARTIFACT_DIR=.*find frontend-artifact/)
  assert.match(workflow, /hot-frontend-\$RUN_ID/)
  assert.match(workflow, /pg_dump -U myndbbs myndbbs/)
  assert.match(workflow, /uploads-data\.tar/)
  assert.match(workflow, /docker save "\$BACKEND_IMAGE_ID"/)
  assert.match(workflow, /docker save "\$FRONTEND_IMAGE_ID"/)
})

test('core Docker publish includes the isolated plugin runtime image', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/docker-publish.yml'), 'utf8')
  assert.match(workflow, /myndbbs-plugin-runtime/)
  assert.match(workflow, /packages\/backend\/plugin-runtime\/Dockerfile/)
})
