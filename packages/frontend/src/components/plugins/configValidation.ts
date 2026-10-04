import { pointerChild, type ConfigSchema } from './PluginConfigFields'

const keywords = new Set(['type', 'title', 'description', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'default', '$schema'])
export function supportedSchema(schema: ConfigSchema, depth = 0): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || depth > 20 || Object.keys(schema).some((key) => !keywords.has(key))) return false
  if (!['object', 'array', 'string', 'number', 'integer', 'boolean'].includes(schema.type ?? '')) return false
  if (schema.type === 'object') return Object.values(schema.properties ?? {}).every((child) => supportedSchema(child, depth + 1))
  if (schema.type === 'array') return Boolean(schema.items && supportedSchema(schema.items, depth + 1))
  return !schema.enum || schema.enum.every((value) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
}

export function configIsValid(value: unknown, schema: ConfigSchema, secrets: string[], path = ''): boolean {
  if (!supportedSchema(schema)) return false
  // Keep/clear markers are resolved before backend schema validation.
  if (secrets.includes(path) && (value === undefined || value === null || value === '********')) return true
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) return false
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const object = value as Record<string, unknown>
    if (schema.required?.some((key) => object[key] === undefined && !secrets.includes(pointerChild(path, key)))) return false
    return Object.entries(schema.properties ?? {}).every(([key, child]) => object[key] === undefined || configIsValid(object[key], child, secrets, pointerChild(path, key)))
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) && Boolean(schema.items) && value.every((item, index) => configIsValid(item, schema.items!, secrets, pointerChild(path, String(index))))
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  return typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isInteger(value)) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
}
