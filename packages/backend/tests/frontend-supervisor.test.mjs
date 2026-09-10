import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { FrontendSupervisor } from '../../../scripts/frontend-supervisor.mjs'

test('frontend supervisor keeps old release when new release fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-front-'))
  const good = path.join(root, 'good'); const bad = path.join(root, 'bad'); await mkdir(good); await mkdir(bad)
  await writeFile(path.join(good, 'manifest.json'), JSON.stringify({ version: 'good' })); await writeFile(path.join(bad, 'manifest.json'), JSON.stringify({ version: 'bad' }))
  await writeFile(path.join(good, 'server.js'), "const http=require('http');http.createServer((q,r)=>r.end('good')).listen(process.env.PORT, '127.0.0.1')")
  await writeFile(path.join(bad, 'server.js'), "throw new Error('broken')")
  const supervisor = new FrontendSupervisor(); const probe = async (port) => new Promise((resolve, reject) => { const req = http.get(`http://127.0.0.1:${port}`, r => r.statusCode === 200 ? resolve() : reject()); req.on('error', reject) })
  try { await supervisor.switchTo(good, 38081, probe); await assert.rejects(supervisor.switchTo(bad, 38082, probe), /ERR_FRONTEND_START_FAILED|ERR_FRONTEND_START_TIMEOUT/); } finally { await supervisor.stop(); await rm(root, { recursive: true, force: true }) }
})
