import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const rollbackScript = path.join(root, 'scripts', 'rollback-frontend-release.sh')
const installerScript = path.join(root, 'scripts', 'install-frontend-release.sh')

const bash = process.platform === 'win32'
  ? [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    ].find((candidate) => fs.existsSync(candidate)) ?? 'bash'
  : process.env.BASH || 'bash'

const toBashPath = (value) => {
  if (process.platform !== 'win32') return value
  return path.resolve(value).replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
}

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`

const NO_STATE = Symbol('NO_STATE')
const NO_ACTIVE = Symbol('NO_ACTIVE')
const CURRENT_ACTIVE = 'server 127.0.0.1:3311;\n'

function makeState(overrides = {}) {
  const version = overrides.version ?? 'release-1'
  return {
    version,
    container: overrides.container ?? `myndbbs-frontend-hot-${version}`,
    port: overrides.port ?? 3311,
    previous: overrides.previous ?? null,
    artifactSha256: overrides.artifactSha256 ?? 'a'.repeat(64),
  }
}

function installerStateParser() {
  const installer = fs.readFileSync(installerScript, 'utf8')
  const match = installer.match(
    /PREVIOUS=\$\(python3 - "\$STATE" <<'PY'\r?\n([\s\S]*?)\r?\nPY\r?\n\)/,
  )
  assert.ok(match, 'installer state parser heredoc is missing')
  return match[1]
}

function runInstallerStateParser(stateValue) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'myndbbs-installer-state-'))
  const state = path.join(fixture, 'hot-state-frontend.json')
  fs.writeFileSync(
    state,
    typeof stateValue === 'string' ? stateValue : `${JSON.stringify(stateValue)}\n`,
  )
  try {
    return spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-', state], {
      input: installerStateParser(),
      encoding: 'utf8',
    })
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
}

function runRollback(
  stateValue,
  {
    sudoFailure = '',
    failStateCommit = false,
    failActiveRestore = false,
    activeValue = CURRENT_ACTIVE,
  } = {},
) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'myndbbs-frontend-rollback-'))
  const releaseRoot = path.join(fixture, 'release-root')
  const confDir = path.join(fixture, 'openresty')
  const conf = path.join(confDir, 'site.conf')
  const mockBin = path.join(fixture, 'mock-bin')
  const mockLog = path.join(fixture, 'mock.log')
  const sudoFailureMarker = path.join(fixture, 'sudo-failure.marker')
  const state = path.join(releaseRoot, 'hot-state-frontend.json')
  const active = path.join(confDir, 'myndbbs-frontend-active-upstream.inc')

  fs.mkdirSync(releaseRoot, { recursive: true })
  fs.mkdirSync(confDir, { recursive: true })
  fs.mkdirSync(mockBin, { recursive: true })
  fs.writeFileSync(
    path.join(mockBin, 'sudo'),
    [
      '#!/usr/bin/env bash',
      'printf \'sudo:%s\\n\' "$*" >> "$MOCK_LOG"',
      'if [ ! -e "$MOCK_SUDO_FAIL_MARKER" ]; then',
      '  if [ "${MOCK_SUDO_FAIL:-}" = "test" ] && [[ "$*" == *"openresty -t"* ]]; then',
      '    : > "$MOCK_SUDO_FAIL_MARKER"',
      '    exit 41',
      '  fi',
      '  if [ "${MOCK_SUDO_FAIL:-}" = "reload" ] && [[ "$*" == *"openresty -s reload"* ]]; then',
      '    : > "$MOCK_SUDO_FAIL_MARKER"',
      '    exit 42',
      '  fi',
      'fi',
      'exit 0',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(mockBin, 'docker'),
    '#!/usr/bin/env bash\nprintf \'docker:%s\\n\' "$*" >> "$MOCK_LOG"\nexit 0\n',
  )
  fs.writeFileSync(
    path.join(mockBin, 'mv'),
    [
      '#!/usr/bin/env bash',
      'printf \'mv:%s\\n\' "$*" >> "$MOCK_LOG"',
      'if [ "${MOCK_FAIL_STATE_COMMIT:-}" = "1" ] &&',
      '   [ "${2:-}" = "$MOCK_STATE.next" ] && [ "${3:-}" = "$MOCK_STATE" ]; then',
      '  exit 43',
      'fi',
      'if [ "${MOCK_FAIL_ACTIVE_RESTORE:-}" = "1" ] && [ "$#" -eq 3 ] &&',
      '   [ "${1:-}" = "-f" ] && [[ "${2:-}" == "$MOCK_ACTIVE.rollback."* ]] &&',
      '   [ "${3:-}" = "$MOCK_ACTIVE" ]; then',
      '  exit 44',
      'fi',
      'exec "$REAL_MV" "$@"',
      '',
    ].join('\n'),
  )
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(mockBin, 'python3'), '#!/usr/bin/env bash\nexec python "$@"\n')
  }
  for (const command of fs.readdirSync(mockBin)) {
    fs.chmodSync(path.join(mockBin, command), 0o755)
  }

  if (stateValue !== NO_STATE) {
    fs.writeFileSync(
      state,
      typeof stateValue === 'string' ? stateValue : `${JSON.stringify(stateValue)}\n`,
    )
  }
  if (activeValue !== NO_ACTIVE) {
    fs.writeFileSync(active, activeValue)
  }

  const command = [
    'export REAL_MV=$(command -v mv)',
    `export PATH=${shellQuote(toBashPath(mockBin))}:$PATH`,
    `export MOCK_LOG=${shellQuote(toBashPath(mockLog))}`,
    `export MOCK_SUDO_FAIL=${shellQuote(sudoFailure)}`,
    `export MOCK_SUDO_FAIL_MARKER=${shellQuote(toBashPath(sudoFailureMarker))}`,
    `export MOCK_FAIL_STATE_COMMIT=${failStateCommit ? '1' : '0'}`,
    `export MOCK_FAIL_ACTIVE_RESTORE=${failActiveRestore ? '1' : '0'}`,
    `export MOCK_STATE=${shellQuote(toBashPath(state))}`,
    `export MOCK_ACTIVE=${shellQuote(toBashPath(active))}`,
    [
      'bash',
      shellQuote(toBashPath(rollbackScript)),
      shellQuote(toBashPath(releaseRoot)),
      shellQuote(toBashPath(conf)),
      'mock-openresty',
    ].join(' '),
  ].join('\n')

  try {
    const execution = spawnSync(bash, ['-lc', command], { encoding: 'utf8' })
    const activeBackupFiles = fs
      .readdirSync(confDir)
      .filter((entry) => entry.startsWith(`${path.basename(active)}.rollback.`))
    return {
      ...execution,
      active: fs.existsSync(active) ? fs.readFileSync(active, 'utf8') : null,
      activeNextExists: fs.existsSync(`${active}.next`),
      stateExists: fs.existsSync(state),
      state: fs.existsSync(state) ? fs.readFileSync(state, 'utf8') : null,
      stateNextExists: fs.existsSync(`${state}.next`),
      activeBackupFiles,
      activeBackupContents: activeBackupFiles.map((entry) =>
        fs.readFileSync(path.join(confDir, entry), 'utf8'),
      ),
      log: fs.existsSync(mockLog) ? fs.readFileSync(mockLog, 'utf8') : '',
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
}

function assertRollbackSucceeded(result) {
  assert.equal(
    result.status,
    0,
    `rollback failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  assert.match(result.log, /sudo:-n docker exec mock-openresty .*openresty -t/)
  assert.match(result.log, /sudo:-n docker exec mock-openresty .*openresty -s reload/)
  assertRollbackTempsCleaned(result)
}

function assertRollbackTempsCleaned(result) {
  assert.equal(result.activeNextExists, false)
  assert.equal(result.stateNextExists, false)
  assert.deepEqual(result.activeBackupFiles, [])
}

function assertActiveRecoveryRan(result, failedCommand) {
  const testCalls = result.log.match(/sudo:[^\n]*openresty -t/g) ?? []
  const reloadCalls = result.log.match(/sudo:[^\n]*openresty -s reload/g) ?? []
  assert.equal(testCalls.length, 2)
  assert.equal(reloadCalls.length, failedCommand === 'test' ? 1 : 2)
}

function assertRollbackRejectedBeforeSwitch(result) {
  assert.notEqual(result.status, 0)
  assert.equal(result.active, CURRENT_ACTIVE)
  assertRollbackTempsCleaned(result)
  assert.equal(result.log, '')
}

test('hot release workflow builds on GitHub and deploys only when explicitly requested', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/hot-release.yml'), 'utf8')
  const installer = fs.readFileSync(path.join(root, 'scripts/install-frontend-release.sh'), 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /pnpm --filter frontend build/)
  assert.match(
    workflow,
    /- run: pnpm --filter frontend build\r?\n\s+env:\r?\n\s+API_URL: http:\/\/myndbbs-backend:3001/,
  )
  assert.match(workflow, /inputs\.deploy == true/)
  assert.match(workflow, /appleboy\/scp-action/)
  assert.match(workflow, /ensure-openresty-hot-update\.sh/)
  assert.match(workflow, /install-frontend-release\.sh/)
  assert.match(workflow, /path: frontend-artifact/)
  assert.match(workflow, /ARTIFACT_TAR=.*find frontend-artifact -type f -name 'frontend-release-\*\.tar\.gz'/)
  assert.match(workflow, /ARTIFACT_SHA=.*\.sha256/)
  assert.match(workflow, /sha256sum --check/)
  assert.match(workflow, /tar --dereference -czf "frontend-release-\$\{GITHUB_SHA\}\.tar\.gz"/)
  assert.match(workflow, /Smoke test immutable frontend release/)
  assert.match(workflow, /find release-smoke -type l/)
  assert.match(workflow, /NODE_PATH="\$PWD\/release-smoke\/node_modules\/\.pnpm\/node_modules"/)
  assert.match(workflow, /for _ in \$\(seq 1 600\); do[\s\S]*?sleep 1\r?\n\s+done/)
  assert.doesNotMatch(workflow, /for _ in \$\(seq 1 (?:30|90|180|300|420); do/)
  assert.match(workflow, /curl -fsS --max-time 2 http:\/\/127\.0\.0\.1:3119\/robots\.txt/)
  assert.match(workflow, /request\.url !== '\/uploads\/hot-release-probe\.txt'/)
  assert.match(workflow, /127\.0\.0\.2 myndbbs-backend/)
  assert.match(workflow, /\.listen\(3001, '127\.0\.0\.2'\)/)
  assert.match(
    workflow,
    /curl -fsS --max-time 2 http:\/\/127\.0\.0\.1:3119\/uploads\/hot-release-probe\.txt/,
  )
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
  assert.match(installer, /RUNTIME_NODE_PATH="\$RELEASE\/node_modules\/\.pnpm\/node_modules"/)
  assert.match(installer, /NODE_PATH=\/app\/node_modules\/\.pnpm\/node_modules/)
  assert.ok(
    installer.indexOf('trap cleanup EXIT') <
      installer.indexOf("if [ ! -d \"$RUNTIME_NODE_PATH\" ]"),
  )
})

test('core Docker publish includes the isolated plugin runtime image', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/docker-publish.yml'), 'utf8')
  assert.match(workflow, /myndbbs-plugin-runtime/)
  assert.match(workflow, /packages\/backend\/plugin-runtime\/Dockerfile/)
})

test('frontend installer validates non-empty state before starting a candidate', () => {
  const installer = fs.readFileSync(installerScript, 'utf8')
  assert.match(installer, /if \[ -f "\$STATE" \] && \[ -s "\$STATE" \]; then/)
  assert.match(installer, /PREVIOUS=\$\(python3 - "\$STATE" <<'PY'/)
  assert.match(installer, /type\(port\) is not int/)
  assert.match(installer, /container != f'myndbbs-frontend-hot-\{version\}'/)
  assert.match(installer, /SHA256_PATTERN\.fullmatch\(artifact_sha256\)/)
  assert.ok(installer.indexOf('PREVIOUS=$(python3') < installer.indexOf('docker pull "$IMAGE"'))
  assert.ok(installer.indexOf('PREVIOUS=$(python3') < installer.indexOf('docker run -d'))
  assert.match(
    installer,
    /printf '%s\\n' "\$PREVIOUS" > "\$STATE\.next" && mv -f "\$STATE\.next" "\$STATE"/,
  )
})

test('installer state parser rejects malformed schema before state embedding', async (t) => {
  await t.test('valid state is emitted as canonical JSON', () => {
    const state = makeState()
    const result = runInstallerStateParser(state)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), state)
  })

  await t.test('malformed JSON is rejected', () => {
    const result = runInstallerStateParser('{')
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  })

  for (const port of [true, '3312', 3312.5]) {
    await t.test(`strictly rejects port ${JSON.stringify(port)}`, () => {
      const result = runInstallerStateParser(makeState({ port }))
      assert.notEqual(result.status, 0)
      assert.equal(result.stdout, '')
    })
  }

  await t.test('rejects an arbitrary current container', () => {
    const result = runInstallerStateParser(makeState({ container: 'arbitrary-container' }))
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  })

  await t.test('rejects an arbitrary previous container recursively', () => {
    const previous = makeState({
      version: 'previous-release',
      container: 'arbitrary-previous',
      port: 3312,
    })
    const result = runInstallerStateParser(makeState({ previous }))
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  })

  await t.test('rejects a scalar previous value', () => {
    const result = runInstallerStateParser(makeState({ previous: 'invalid' }))
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  })

  await t.test('rejects invalid version and artifact metadata', () => {
    const invalidVersion = runInstallerStateParser(makeState({ version: '../escape' }))
    const invalidArtifact = runInstallerStateParser(makeState({ artifactSha256: 'not-a-sha' }))
    assert.notEqual(invalidVersion.status, 0)
    assert.notEqual(invalidArtifact.status, 0)
  })
})

test('frontend rollback stages traffic and commits state transactionally', () => {
  const rollback = fs.readFileSync(rollbackScript, 'utf8')
  assert.match(rollback, /state_next\.write_text\(json\.dumps\(previous/)
  assert.match(rollback, /ACTIVE_BACKUP=\$\(mktemp "\$\{ACTIVE\}\.rollback\.XXXXXX"\)/)
  assert.match(rollback, /cp -p -- "\$ACTIVE" "\$ACTIVE_BACKUP"/)
  assert.match(rollback, /mv -f "\$ACTIVE_BACKUP" "\$ACTIVE"/)
  assert.match(rollback, /PRESERVE_ACTIVE_BACKUP=1/)
  assert.match(rollback, /backup retained at %s/)
  assert.match(rollback, /mv -f "\$STATE\.next" "\$STATE"/)
  assert.match(rollback, /rm -f "\$ACTIVE\.next" "\$STATE\.next"/)
  assert.ok(
    rollback.lastIndexOf('mv -f "$STATE.next" "$STATE"') <
      rollback.lastIndexOf('docker rm -f "$CURRENT"'),
  )
  assert.ok(
    rollback.lastIndexOf('COMMITTED=1') < rollback.lastIndexOf('docker rm -f "$CURRENT"'),
  )
  assert.doesNotMatch(rollback, /Path\(sys\.argv\[1\]\)\.write_text/)
})

test('frontend rollback keeps traffic, state, and containers transactionally aligned', async (t) => {
  await t.test('missing state routes to core and remains absent', () => {
    const result = runRollback(NO_STATE)
    assertRollbackSucceeded(result)
    assert.equal(result.active.trim(), 'server 127.0.0.1:3100;')
    assert.equal(result.stateExists, false)
    assert.doesNotMatch(result.log, /docker:rm -f/)
  })

  await t.test('empty state routes to core and is removed', () => {
    const result = runRollback('')
    assertRollbackSucceeded(result)
    assert.equal(result.active.trim(), 'server 127.0.0.1:3100;')
    assert.equal(result.stateExists, false)
    assert.doesNotMatch(result.log, /docker:rm -f/)
  })

  for (const sudoFailure of ['test', 'reload']) {
    await t.test(`empty state is removed and active is restored when OpenResty ${sudoFailure} fails`, () => {
      const result = runRollback('', { sudoFailure })
      assert.notEqual(result.status, 0)
      assert.equal(result.active, CURRENT_ACTIVE)
      assert.equal(result.stateExists, false)
      assertRollbackTempsCleaned(result)
      assertActiveRecoveryRan(result, sudoFailure)
      assert.doesNotMatch(result.log, /docker:rm -f/)
    })
  }

  await t.test('previous null routes to core, removes current, and deletes state', () => {
    const current = makeState({ version: 'new-release' })
    const result = runRollback(current)
    assertRollbackSucceeded(result)
    assert.equal(result.active.trim(), 'server 127.0.0.1:3100;')
    assert.equal(result.stateExists, false)
    assert.match(result.log, /docker:rm -f myndbbs-frontend-hot-new-release/)
  })

  await t.test('previous object restores its port and remains valid JSON state', () => {
    const previous = makeState({
      version: 'previous-release',
      port: 3312,
    })
    const current = makeState({ version: 'new-release', previous })
    const result = runRollback(current)
    assertRollbackSucceeded(result)
    assert.equal(result.active.trim(), 'server 127.0.0.1:3312;')
    assert.equal(result.stateExists, true)
    assert.deepEqual(JSON.parse(result.state), previous)
    assert.match(result.log, /docker:rm -f myndbbs-frontend-hot-new-release/)
  })

  for (const sudoFailure of ['test', 'reload']) {
    await t.test(`OpenResty ${sudoFailure} failure restores active and keeps current state`, () => {
      const previous = makeState({ version: 'previous-release', port: 3312 })
      const current = makeState({ version: 'new-release', previous })
      const result = runRollback(current, { sudoFailure })
      assert.notEqual(result.status, 0)
      assert.equal(result.active, CURRENT_ACTIVE)
      assert.equal(result.stateExists, true)
      assert.deepEqual(JSON.parse(result.state), current)
      assertRollbackTempsCleaned(result)
      assertActiveRecoveryRan(result, sudoFailure)
      assert.doesNotMatch(result.log, /docker:rm -f/)
    })
  }

  await t.test('OpenResty failure removes active when no original active existed', () => {
    const current = makeState({ version: 'new-release' })
    const result = runRollback(current, { sudoFailure: 'test', activeValue: NO_ACTIVE })
    assert.notEqual(result.status, 0)
    assert.equal(result.active, null)
    assert.equal(result.stateExists, true)
    assert.deepEqual(JSON.parse(result.state), current)
    assertRollbackTempsCleaned(result)
    assertActiveRecoveryRan(result, 'test')
    assert.doesNotMatch(result.log, /docker:rm -f/)
  })

  await t.test('state commit failure restores active and preserves current container and state', () => {
    const previous = makeState({ version: 'previous-release', port: 3312 })
    const current = makeState({ version: 'new-release', previous })
    const result = runRollback(current, { failStateCommit: true })
    assert.notEqual(result.status, 0)
    assert.equal(result.active, CURRENT_ACTIVE)
    assert.equal(result.stateExists, true)
    assert.deepEqual(JSON.parse(result.state), current)
    assertRollbackTempsCleaned(result)
    assertActiveRecoveryRan(result, 'stateCommit')
    assert.match(
      result.log,
      /mv:-f .*hot-state-frontend\.json\.next .*hot-state-frontend\.json/,
    )
    assert.doesNotMatch(result.log, /docker:rm -f/)
  })

  await t.test('active restore failure retains the original backup and exit status', () => {
    const previous = makeState({ version: 'previous-release', port: 3312 })
    const current = makeState({ version: 'new-release', previous })
    const result = runRollback(current, {
      sudoFailure: 'test',
      failActiveRestore: true,
    })
    assert.equal(result.status, 41)
    assert.equal(result.active.trim(), 'server 127.0.0.1:3312;')
    assert.equal(result.stateExists, true)
    assert.deepEqual(JSON.parse(result.state), current)
    assert.equal(result.activeNextExists, false)
    assert.equal(result.stateNextExists, false)
    assert.equal(result.activeBackupFiles.length, 1)
    assert.deepEqual(result.activeBackupContents, [CURRENT_ACTIVE])
    assert.match(result.stderr, /backup retained at .*\.rollback\./)
    assert.doesNotMatch(result.log, /docker:rm -f/)
  })
})

test('frontend rollback rejects malformed state before traffic or container changes', async (t) => {
  await t.test('malformed JSON fails closed', () => {
    const result = runRollback('{')
    assertRollbackRejectedBeforeSwitch(result)
    assert.equal(result.stateExists, true)
  })

  for (const port of [true, '3312', 3312.5]) {
    await t.test(`strictly rejects previous port ${JSON.stringify(port)}`, () => {
      const previous = makeState({ version: 'previous-release', port })
      const result = runRollback(makeState({ version: 'new-release', previous }))
      assertRollbackRejectedBeforeSwitch(result)
      assert.equal(result.stateExists, true)
    })
  }

  await t.test('rejects an arbitrary current container before docker rm', () => {
    const result = runRollback(makeState({ container: 'arbitrary-container' }))
    assertRollbackRejectedBeforeSwitch(result)
    assert.equal(result.stateExists, true)
  })

  await t.test('rejects an arbitrary previous container recursively', () => {
    const previous = makeState({
      version: 'previous-release',
      container: 'arbitrary-previous',
      port: 3312,
    })
    const result = runRollback(makeState({ version: 'new-release', previous }))
    assertRollbackRejectedBeforeSwitch(result)
    assert.equal(result.stateExists, true)
  })

  await t.test('rejects a scalar previous value', () => {
    const result = runRollback(makeState({ previous: 'invalid' }))
    assertRollbackRejectedBeforeSwitch(result)
    assert.equal(result.stateExists, true)
  })
})
