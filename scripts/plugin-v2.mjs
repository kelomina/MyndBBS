import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto'

export const ID = /^[a-z0-9][a-z0-9-]{1,62}$/
export const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
export const METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']
export const SLOTS = ['admin.sidebar', 'admin.dashboard', 'admin.detail']
export const AUTH = ['authenticated', 'admin', 'super_admin']
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
export const isObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export function safeRelative(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    value
      .split('/')
      .every(
        (part) =>
          /^[a-zA-Z0-9@_+.-]+$/.test(part) &&
          part !== '.' &&
          part !== '..' &&
          !part.endsWith('.') &&
          !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part),
      )
  )
}
export function safeRoute(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    (value === '/' || safeRelative(value.slice(1).replace(/(?:^|\/)\*$/, 'wildcard'))) &&
    !value.startsWith('/__') &&
    !value.includes('//')
  )
}
export function routeMatches(route, url) {
  if (route.endsWith('/*')) return url === route.slice(0, -2) || url.startsWith(route.slice(0, -1))
  return route === url
}
export function safeRequestPath(value) {
  if (typeof value !== 'string' || value.length > 4096) return false
  const pathname = value.split('?')[0]
  return pathname === '/' || (pathname.startsWith('/') && safeRelative(pathname.slice(1)))
}
export function authAllowed(role, level = 'authenticated') {
  return level === 'super_admin'
    ? role === 'SUPER_ADMIN'
    : level === 'admin'
      ? ['ADMIN', 'SUPER_ADMIN'].includes(role)
      : ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)
}
export function validateSchema(schema, depth = 0) {
  const allowed = [
    'type',
    'properties',
    'required',
    'additionalProperties',
    'items',
    'enum',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'title',
    'description',
    'default',
  ]
  if (
    !isObject(schema) ||
    depth > 16 ||
    Object.keys(schema).some((k) => !allowed.includes(k)) ||
    !['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(schema.type)
  )
    throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
  if (schema.properties !== undefined) {
    if (
      schema.type !== 'object' ||
      !isObject(schema.properties) ||
      Object.keys(schema.properties).length > 128
    )
      throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
    for (const [key, child] of Object.entries(schema.properties)) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
      validateSchema(child, depth + 1)
    }
  }
  if (
    schema.required !== undefined &&
    (!Array.isArray(schema.required) ||
      schema.required.some(
        (k) => typeof k !== 'string' || !Object.hasOwn(schema.properties || {}, k),
      ))
  )
    throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean')
    throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
  if (schema.type === 'array') validateSchema(schema.items, depth + 1)
  if (
    schema.enum !== undefined &&
    (!Array.isArray(schema.enum) ||
      schema.enum.length < 1 ||
      schema.enum.length > 100 ||
      schema.enum.some((v) => v !== null && !['string', 'number', 'boolean'].includes(typeof v)))
  )
    throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems'])
    if (
      schema[key] !== undefined &&
      (!Number.isFinite(schema[key]) ||
        ((key.startsWith('minL') || key.startsWith('maxL') || key.endsWith('Items')) &&
          (!Number.isInteger(schema[key]) || schema[key] < 0)))
    )
      throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
}
export function validateManifest(m) {
  if (
    !isObject(m) ||
    m.apiVersion !== 2 ||
    typeof m.id !== 'string' ||
    !ID.test(m.id) ||
    typeof m.version !== 'string' ||
    !VERSION.test(m.version) ||
    typeof m.entrySha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(m.entrySha256) ||
    typeof m.signatureKeyId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(m.signatureKeyId)
  )
    throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  if (!safeRelative(m.entry)) throw new Error('ERR_INVALID_PLUGIN_ENTRY')
  if (m.displayName !== undefined && (typeof m.displayName !== 'string' || m.displayName.length > 120) || m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 2000)) throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  const c = m.capabilities
  if (
    !isObject(c) ||
    Object.keys(c).some((k) => !['routes', 'events', 'ui', 'config'].includes(k)) ||
    ['routes', 'events', 'ui'].some((k) => !Array.isArray(c[k]) || c[k].length > 128)
  )
    throw new Error('ERR_INVALID_PLUGIN_CAPABILITIES')
  for (const r of c.routes)
    if (
      !isObject(r) ||
      !safeRoute(r.path) ||
      !Array.isArray(r.methods) ||
      !r.methods.length ||
      r.methods.some((m) => !METHODS.includes(m)) ||
      (r.auth !== undefined && !AUTH.includes(r.auth))
    )
      throw new Error('ERR_INVALID_PLUGIN_ROUTE_CAPABILITY')
  for (const e of c.events)
    if (
      !isObject(e) ||
      typeof e.name !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(e.name) ||
      !Number.isInteger(e.version) ||
      e.version < 1 ||
      e.version > 1000
    )
      throw new Error('ERR_INVALID_PLUGIN_EVENT_CAPABILITY')
  for (const u of c.ui)
    if (
      !isObject(u) ||
      !SLOTS.includes(u.slot) ||
      !safeRelative(u.path) ||
      !u.path.endsWith('.html')
    )
      throw new Error('ERR_INVALID_PLUGIN_UI_CAPABILITY')
  if (c.config !== undefined) {
    if (
      !isObject(c.config) ||
      !isObject(c.config.schema) ||
      c.config.schema.type !== 'object' ||
      !Array.isArray(c.config.secretPaths) ||
      c.config.secretPaths.length > 64
    )
      throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
    validateSchema(c.config.schema)
    const seen = []
    for (const pointer of c.config.secretPaths) {
      if (
        typeof pointer !== 'string' ||
        !pointer.startsWith('/') ||
        pointer.length > 512 ||
        /~(?![01])/.test(pointer)
      )
        throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
      const tokens = pointer
        .slice(1)
        .split('/')
        .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'))
      if (
        tokens.some((t) => !t || FORBIDDEN_KEYS.has(t)) ||
        seen.some(
          (p) => p === pointer || p.startsWith(pointer + '/') || pointer.startsWith(p + '/'),
        )
      )
        throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
      let schema = c.config.schema
      for (const token of tokens) {
        if (schema.type !== 'object' || !Object.hasOwn(schema.properties || {}, token))
          throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
        schema = schema.properties[token]
      }
      if (schema.type !== 'string') throw new Error('ERR_INVALID_PLUGIN_CONFIG_CAPABILITY')
      seen.push(pointer)
    }
  }
}
export function canonicalize(value) {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  if (!isObject(value)) throw new Error('ERR_INVALID_CANONICAL_JSON')
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]))
      .join(',') +
    '}'
  )
}
export function signingPayload(digest, manifest) {
  validateManifest(manifest)
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('ERR_INVALID_PLUGIN_ARCHIVE_HASH')
  return Buffer.from('MYNDBBS_PLUGIN_V2\n' + digest + '\n' + canonicalize(manifest) + '\n')
}
export function verifySignature(signature, publicKey, digest, manifest) {
  try {
    const key = createPublicKey(publicKey)
    return (
      key.asymmetricKeyType === 'ed25519' &&
      signature.length === 64 &&
      verify(null, signingPayload(digest, manifest), key, signature)
    )
  } catch {
    return false
  }
}
export function tokenMatches(actual, expected) {
  return (
    typeof actual === 'string' &&
    typeof expected === 'string' &&
    expected.length >= 32 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
}
