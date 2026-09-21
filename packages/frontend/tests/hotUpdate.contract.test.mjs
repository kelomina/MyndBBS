import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

test('hot release workflow builds on GitHub and deploys only when explicitly requested', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/hot-release.yml'), 'utf8')
  const installer = fs.readFileSync(path.join(root, 'scripts/install-frontend-release.sh'), 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /pnpm --filter frontend build/)
  assert.match(workflow, /inputs\.deploy == true/)
  assert.match(workflow, /appleboy\/scp-action/)
  assert.match(workflow, /ensure-openresty-hot-update\.sh/)
  assert.match(workflow, /install-frontend-release\.sh/)
  assert.match(workflow, /path: frontend-artifact/)
  assert.match(workflow, /ARTIFACT_TAR=.*find frontend-artifact -type f -name 'frontend-release-\*\.tar\.gz'/)
  assert.match(workflow, /ARTIFACT_SHA=.*\.sha256/)
  assert.match(workflow, /sha256sum --check/)
  assert.match(workflow, /sha256sum "frontend-release-\$\{GITHUB_SHA\}\.tar\.gz" > "frontend-release-\$\{GITHUB_SHA\}\.sha256"/)
  assert.match(workflow, /hot-frontend-\$RUN_ID/)
  assert.match(workflow, /pg_dump -U myndbbs myndbbs/)
  assert.match(workflow, /uploads-data\.tar/)
  assert.match(workflow, /docker save "\$BACKEND_IMAGE_ID"/)
  assert.match(workflow, /docker save "\$FRONTEND_IMAGE_ID"/)
  assert.equal((workflow.match(/GHCR_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/g) ?? []).length, 3)
  assert.equal((workflow.match(/docker login ghcr\.io --username "\$GHCR_USER" --password-stdin/g) ?? []).length, 3)
  assert.doesNotMatch(workflow, /script_stop:/)
  assert.match(installer, /CHECKSUM_FILE="\$\{ARCHIVE%\.tar\.gz\}\.sha256"/)
})

test('core Docker publish includes the isolated plugin runtime image', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/docker-publish.yml'), 'utf8')
  assert.match(workflow, /myndbbs-plugin-runtime/)
  assert.match(workflow, /packages\/backend\/plugin-runtime\/Dockerfile/)
})
