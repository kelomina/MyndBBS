import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { validateSchema } from './PluginManifest'

const ALGORITHM = 'aes-256-gcm'
const SECRET_PREFIX = 'v1'

type JsonObject = Record<string, unknown>

const forbidden = new Set(['__proto__', 'constructor', 'prototype'])

function safeJson(value: unknown, depth = 0): void {
  if (depth > 30) throw new Error('ERR_INVALID_PLUGIN_CONFIG')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (
    !value ||
    typeof value !== 'object' ||
    (!Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new Error('ERR_INVALID_PLUGIN_CONFIG')
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) throw new Error('ERR_INVALID_PLUGIN_CONFIG')
    safeJson(child, depth + 1)
  }
}

function clone<T>(value: T): T {
  safeJson(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function decodePointerPart(value: string): string {
  return value.replace(/~1/g, '/').replace(/~0/g, '~')
}

function pointerParts(pointer: string): string[] {
  if (
    typeof pointer !== 'string' ||
    !pointer.startsWith('/') ||
    pointer === '/' ||
    pointer.length > 512
  )
    throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  if (/~(?![01])/u.test(pointer)) throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  const parts = pointer.slice(1).split('/').map(decodePointerPart)
  if (parts.some((part) => !part || forbidden.has(part)))
    throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  return parts
}

function isContainer(value: unknown): value is JsonObject | unknown[] {
  return Boolean(value) && typeof value === 'object'
}

function getAt(root: unknown, pointer: string): unknown {
  let current = root
  for (const part of pointerParts(pointer)) {
    if (!isContainer(current)) return undefined
    if (Array.isArray(current)) throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
    current = Object.hasOwn(current, part) ? current[part] : undefined
  }
  return current
}

function deleteAt(root: unknown, pointer: string): void {
  const parts = pointerParts(pointer)
  let current = root
  for (const part of parts.slice(0, -1)) {
    if (!isContainer(current)) return
    if (Array.isArray(current)) throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
    current = Object.hasOwn(current, part) ? current[part] : undefined
  }
  if (!isContainer(current)) return
  const last = parts.at(-1)!
  if (Array.isArray(current)) {
    throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  } else {
    delete current[last]
  }
}

function setAt(root: unknown, pointer: string, value: unknown): void {
  const parts = pointerParts(pointer)
  let current: JsonObject | unknown[] = root as JsonObject
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) {
      throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
    } else {
      const existing = current[part]
      if (!isContainer(existing) || Array.isArray(existing)) current[part] = {}
      current = current[part] as JsonObject
    }
  }
  const last = parts.at(-1)!
  if (Array.isArray(current)) {
    throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  } else {
    current[last] = value
  }
}

function hasSecretValues(value: unknown): boolean {
  return (
    isContainer(value) && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)
  )
}

function encryptionKey(): Buffer {
  const raw = process.env.PLUGIN_CONFIG_ENCRYPTION_KEY
  if (!raw) throw new Error('ERR_PLUGIN_CONFIG_KEY_MISSING')
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  const base64 = Buffer.from(raw, 'base64')
  if (base64.length === 32) return base64
  const utf8 = Buffer.from(raw, 'utf8')
  if (utf8.length === 32) return utf8
  throw new Error('ERR_PLUGIN_CONFIG_KEY_INVALID')
}

export function encryptPluginSecrets(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    SECRET_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function decryptPluginSecrets(value: string): unknown {
  if (!value) return {}
  if (value.split(':').length !== 4) throw new Error('ERR_PLUGIN_CONFIG_CIPHERTEXT_INVALID')
  const [version, ivText, tagText, encryptedText] = value.split(':')
  if (version !== SECRET_PREFIX || !ivText || !tagText || !encryptedText)
    throw new Error('ERR_PLUGIN_CONFIG_CIPHERTEXT_INVALID')
  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivText, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const parsed: unknown = JSON.parse(plain)
    safeJson(parsed)
    return parsed
  } catch {
    throw new Error('ERR_PLUGIN_CONFIG_DECRYPT_FAILED')
  }
}

function schemaTypeMatches(value: unknown, type: unknown): boolean {
  if (typeof type !== 'string') return false
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  if (type === 'array') return Array.isArray(value)
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'null') return value === null
  return false
}

function validateNode(
  value: unknown,
  schema: JsonObject,
  path: string,
  depth: number,
  errors: string[],
): void {
  if (depth > 20) {
    errors.push(`${path}: maximum schema depth exceeded`)
    return
  }
  if (
    '$ref' in schema ||
    'allOf' in schema ||
    'anyOf' in schema ||
    'oneOf' in schema ||
    'not' in schema
  ) {
    errors.push(`${path}: unsupported schema composition`)
    return
  }
  if (schema.type !== undefined && !schemaTypeMatches(value, schema.type))
    errors.push(`${path}: invalid type`)
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))
  )
    errors.push(`${path}: value is not allowed`)
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength)
      errors.push(`${path}: too short`)
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength)
      errors.push(`${path}: too long`)
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum)
      errors.push(`${path}: below minimum`)
    if (typeof schema.maximum === 'number' && value > schema.maximum)
      errors.push(`${path}: above maximum`)
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems)
      errors.push(`${path}: too few items`)
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems)
      errors.push(`${path}: too many items`)
    if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items))
      value.forEach((item, index) =>
        validateNode(item, schema.items as JsonObject, `${path}/${index}`, depth + 1, errors),
      )
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as JsonObject
    const properties =
      schema.properties &&
      typeof schema.properties === 'object' &&
      !Array.isArray(schema.properties)
        ? (schema.properties as JsonObject)
        : {}
    if (Array.isArray(schema.required)) {
      for (const required of schema.required)
        if (typeof required === 'string' && !Object.hasOwn(object, required))
          errors.push(`${path}/${required}: required`)
    }
    for (const [key, child] of Object.entries(object)) {
      if (child === undefined) continue
      if (!Object.hasOwn(properties, key) && schema.additionalProperties === false)
        errors.push(`${path}/${key}: additional property is not allowed`)
      const childSchema = properties[key]
      if (childSchema && typeof childSchema === 'object' && !Array.isArray(childSchema))
        validateNode(child, childSchema as JsonObject, `${path}/${key}`, depth + 1, errors)
    }
  }
}

export function validatePluginConfig(value: unknown, schema: Record<string, unknown>): void {
  safeJson(value)
  validatePluginConfigSchema(schema)
  const errors: string[] = []
  validateNode(value, schema, '', 0, errors)
  if (errors.length > 0) throw new Error('ERR_INVALID_PLUGIN_CONFIG')
}

export function preparePluginConfigUpdate(
  input: unknown,
  secretPaths: readonly string[],
  existingCiphertext?: string,
): { publicConfig: JsonObject; encryptedSecrets: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('ERR_INVALID_PLUGIN_CONFIG')
  validateSecretPointers(secretPaths)
  const publicConfig = clone(input as JsonObject)
  if (secretPaths.length === 0) return { publicConfig, encryptedSecrets: '' }
  const existingSecrets = existingCiphertext ? decryptPluginSecrets(existingCiphertext) : {}
  const secrets: JsonObject = {}
  for (const pointer of secretPaths) {
    const incoming = getAt(input, pointer)
    if (incoming === undefined || incoming === '********') {
      const oldValue = getAt(existingSecrets, pointer)
      if (oldValue !== undefined) setAt(secrets, pointer, oldValue)
    } else if (incoming === null) {
      deleteAt(secrets, pointer)
    } else {
      setAt(secrets, pointer, incoming)
    }
    deleteAt(publicConfig, pointer)
  }
  return {
    publicConfig,
    encryptedSecrets: hasSecretValues(secrets)
      ? encryptPluginSecrets(secrets)
      : encryptPluginSecrets({}),
  }
}

export function publicPluginConfig(
  publicConfig: unknown,
  encryptedSecrets: string | undefined,
  secretPaths: readonly string[],
): JsonObject {
  const result = clone(
    publicConfig && typeof publicConfig === 'object' && !Array.isArray(publicConfig)
      ? (publicConfig as JsonObject)
      : {},
  )
  validateSecretPointers(secretPaths)
  for (const pointer of secretPaths) deleteAt(result, pointer)
  if (!encryptedSecrets || secretPaths.length === 0) return result
  const secrets = decryptPluginSecrets(encryptedSecrets)
  for (const pointer of secretPaths) {
    if (getAt(secrets, pointer) !== undefined) setAt(result, pointer, '********')
  }
  return result
}

function mergeValues(target: unknown, source: unknown): unknown {
  if (
    !isContainer(target) ||
    !isContainer(source) ||
    Array.isArray(target) ||
    Array.isArray(source)
  )
    return clone(source)
  const output = clone(target as JsonObject)
  for (const [key, value] of Object.entries(source as JsonObject))
    output[key] = Object.hasOwn(output, key) ? mergeValues(output[key], value) : clone(value)
  return output
}

export function resolvedPluginConfig(
  publicConfig: unknown,
  encryptedSecrets: string | undefined,
): JsonObject {
  const result = clone(
    publicConfig && typeof publicConfig === 'object' && !Array.isArray(publicConfig)
      ? (publicConfig as JsonObject)
      : {},
  )
  if (!encryptedSecrets) return result
  const secrets = decryptPluginSecrets(encryptedSecrets)
  return mergeValues(result, secrets) as JsonObject
}

/** Validate the same deliberately small schema dialect as the manifest/runtime. */
export function validatePluginConfigSchema(
  schema: JsonObject,
  secretPaths: readonly string[] = [],
): void {
  safeJson(schema)
  try {
    validateSchema(schema)
  } catch {
    throw new Error('ERR_INVALID_PLUGIN_CONFIG')
  }

  if (schema.type !== 'object') throw new Error('ERR_INVALID_PLUGIN_CONFIG')
  validateSecretPointers(secretPaths)
  for (const pointer of secretPaths) {
    let node = schema
    for (const part of pointerParts(pointer)) {
      if (
        node.type !== 'object' ||
        !node.properties ||
        typeof node.properties !== 'object' ||
        !Object.hasOwn(node.properties, part)
      )
        throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
      node = (node.properties as Record<string, JsonObject>)[part]!
    }
    if (node.type !== 'string') throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  }
}

function validateSecretPointers(paths: readonly string[]): void {
  if (paths.length > 64) throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
  const decoded = paths.map(pointerParts)
  for (let i = 0; i < decoded.length; i++)
    for (let j = i + 1; j < decoded.length; j++) {
      const a = decoded[i]!,
        b = decoded[j]!
      if (a.slice(0, Math.min(a.length, b.length)).every((part, index) => part === b[index]))
        throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
    }
}

/** Strip secret material BEFORE interpreting public fields under another version's schema. */
export function configForManifest(
  publicConfig: unknown,
  ciphertext: string | undefined,
  storedPaths: readonly string[],
  targetPaths: readonly string[],
): { publicConfig: JsonObject; encryptedSecrets: string } {
  validateSecretPointers(storedPaths)
  validateSecretPointers(targetPaths)
  const plain = clone((publicConfig ?? {}) as JsonObject)
  for (const pointer of [...storedPaths, ...targetPaths]) deleteAt(plain, pointer)
  const secrets = ciphertext ? decryptPluginSecrets(ciphertext) : {}
  const selected: JsonObject = {}
  for (const pointer of targetPaths) {
    if (!storedPaths.includes(pointer)) continue
    const value = getAt(secrets, pointer)
    if (value !== undefined) setAt(selected, pointer, value)
  }
  return {
    publicConfig: plain,
    encryptedSecrets: hasSecretValues(selected) ? encryptPluginSecrets(selected) : '',
  }
}
