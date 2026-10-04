#!/usr/bin/env node
// Offline-only migration: reads explicit JSON/stdin, never env, network, DB, or plugin code.
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_BYTES = 64 * 1024
const SURFACES = ['registration', 'post', 'comment', 'friendRequest']
const KINDS = ['slider', 'geometry', 'pow']
const POLICY_KEYS = ['captcha_protection', 'captcha_federal', 'federal_protection', 'rate_limit_unlock']
const fail = code => { throw new Error(code) }
const object = (value, keys, required = keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).some(key => !keys.includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) fail('ERR_EXPORT_POLICY_SHAPE')
  return value
}
const boolean = value => {
  if (typeof value !== 'boolean') fail('ERR_EXPORT_POLICY_VALUE')
  return value
}
const choice = (value, choices) => {
  if (!choices.includes(value)) fail('ERR_EXPORT_POLICY_VALUE')
  return value
}
const integer = (value, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) fail('ERR_EXPORT_POLICY_VALUE')
  return value
}

/** Accept explicit policy map or selected SitePolicy rows; never import a full DB dump. */
export function convertLegacyConfig(input) {
  let policies = input
  if (Array.isArray(input)) {
    policies = Object.create(null)
    for (const row of input) {
      object(row, ['key', 'value', 'updatedAt'], ['key', 'value'])
      if (!POLICY_KEYS.includes(row.key) || Object.hasOwn(policies, row.key)) fail('ERR_EXPORT_POLICY_KEYS')
      policies[row.key] = row.value
    }
  }
  object(policies, POLICY_KEYS, ['captcha_protection', 'rate_limit_unlock'])
  const federalKeys = ['captcha_federal', 'federal_protection'].filter(key => Object.hasOwn(policies, key))
  if (federalKeys.length !== 1) fail('ERR_EXPORT_FEDERAL_KEY')

  // Explicit null means the operator confirmed a missing legacy row; use protective defaults.
  const captcha = policies.captcha_protection === null
    ? { enabled: true, surfaces: Object.fromEntries(SURFACES.map(key => [key, true])) }
    : object(policies.captcha_protection, ['enabled', 'surfaces'])
  object(captcha.surfaces, SURFACES)
  const legacyFederal = policies[federalKeys[0]]
  const federal = legacyFederal === null
    ? { enabled: true, kinds: { sliderEnabled: true, geometryEnabled: true, powEnabled: true },
        defaultKind: 'slider', powBits: 16, geometryLevel: 1, timeoutSec: 10, strictTimeoutSec: 15 }
    : object(legacyFederal,
      ['enabled', 'kinds', 'defaultKind', 'powBits', 'geometryLevel', 'timeoutSec', 'strictTimeoutSec'],
      ['enabled', 'kinds', 'defaultKind', 'powBits', 'geometryLevel', 'timeoutSec'])
  object(federal.kinds, ['sliderEnabled', 'geometryEnabled', 'powEnabled'])
  const kinds = Object.fromEntries(KINDS.map(key => [key, boolean(federal.kinds[`${key}Enabled`])]))
  if (!Object.values(kinds).some(Boolean)) fail('ERR_EXPORT_ALL_KINDS_DISABLED')

  let sliderStrength = 'low'
  if (policies.rate_limit_unlock !== null) {
    const rate = object(policies.rate_limit_unlock,
      ['enabled', 'publicReadMax', 'windowSec', 'captchaStrength', 'exemptionMinutes', 'exemptionScope', 'loginRelaxed'])
    boolean(rate.enabled)
    integer(rate.publicReadMax, 10, 1000)
    choice(rate.windowSec, [10, 30, 60, 300, 600])
    integer(rate.exemptionMinutes, 1, 120)
    choice(rate.exemptionScope, ['ip'])
    choice(rate.loginRelaxed, [false])
    sliderStrength = choice(rate.captchaStrength, ['low', 'normal', 'strict'])
  }
  return {
    enabled: boolean(captcha.enabled),
    surfaces: Object.fromEntries(SURFACES.map(key => [key, boolean(captcha.surfaces[key])])),
    sliderStrength,
    federal: {
      enabled: boolean(federal.enabled), kinds,
      defaultKind: choice(federal.defaultKind, KINDS),
      powBits: integer(federal.powBits, 8, 24),
      geometryLevel: integer(federal.geometryLevel, 1, 3),
      timeoutSec: integer(federal.timeoutSec, 5, 60),
      strictTimeoutSec: integer(federal.strictTimeoutSec === undefined ? 15 : federal.strictTimeoutSec, 5, 60),
    },
  }
}

function jsonPath(value) {
  const full = path.resolve(value)
  if (path.extname(full).toLowerCase() !== '.json' ||
      full.split(/[\\/]/).some(part => /^\.env(?:\.|$)/i.test(part))) fail('ERR_EXPORT_JSON_PATH_ONLY')
  return full
}
async function readInput(input) {
  if (input !== '-') {
    const file = jsonPath(await realpath(jsonPath(input)))
    const stat = await lstat(file)
    if (!stat.isFile() || stat.size > MAX_BYTES) fail('ERR_EXPORT_INPUT_LIMIT')
    const bytes = await readFile(file)
    if (bytes.length > MAX_BYTES) fail('ERR_EXPORT_INPUT_LIMIT')
    return bytes.toString('utf8')
  }
  const chunks = []
  let length = 0
  for await (const chunk of process.stdin) {
    length += chunk.length
    if (length > MAX_BYTES) fail('ERR_EXPORT_INPUT_LIMIT')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('node scripts/export-human-verification-config.mjs [--input FILE.json|-] [--out NEW.json]')
    console.log('Default: stdin -> stdout. Offline JSON only; no .env, secrets, network, DB, config save or activation. Output file must not exist.')
    return
  }
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    if (!['--input', '--out'].includes(args[i]) || Object.hasOwn(options, args[i]) ||
        !args[i + 1] || args[i + 1].startsWith('--')) fail('ERR_EXPORT_ARGUMENTS')
    options[args[i]] = args[i + 1]
  }
  const output = options['--out'] ? jsonPath(options['--out']) : null
  const text = await readInput(options['--input'] || '-')
  let parsed
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { fail('ERR_EXPORT_JSON') }
  const result = JSON.stringify(convertLegacyConfig(parsed), null, 2) + '\n'
  if (output) await writeFile(output, result, { flag: 'wx', mode: 0o600 })
  else process.stdout.write(result)
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    // Never echo input values, filesystem paths or underlying error messages.
    console.error(/^ERR_EXPORT_[A-Z_]+$/.test(error.message) ? error.message : 'ERR_EXPORT_IO')
    process.exitCode = 1
  })
}
