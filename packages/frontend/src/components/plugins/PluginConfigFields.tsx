'use client'

import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'

export type ConfigSchema = {
  type?: string
  title?: string
  description?: string
  properties?: Record<string, ConfigSchema>
  required?: string[]
  items?: ConfigSchema
  enum?: unknown[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  default?: unknown
}
export type ConfigLabels = Record<'keep' | 'replace' | 'clear' | 'masked' | 'add' | 'remove' | 'unsupported' | 'arraySecrets' | 'optional', string>
export const pointerChild = (parent: string, key: string) => `${parent}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
const inputClass = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

export function defaultValue(schema: ConfigSchema): unknown {
  if (schema.default !== undefined) return structuredClone(schema.default)
  if (schema.enum?.length) return schema.enum[0]
  switch (schema.type) {
    case 'object': return Object.fromEntries(Object.entries(schema.properties ?? {}).filter(([key]) => schema.required?.includes(key)).map(([key, child]) => [key, defaultValue(child)]))
    case 'array': return []
    case 'number': case 'integer': return schema.minimum ?? 0
    case 'boolean': return false
    default: return ''
  }
}

// No JSON textarea escape hatch: unsupported schemas are explicitly read-only.
export function PluginConfigFields({ schema, value, onChange, secretPaths, labels, disabled = false, path = '', label = '', required = true, depth = 0 }: {
  schema: ConfigSchema; value: unknown; onChange: (value: unknown) => void
  secretPaths: string[]; labels: ConfigLabels; disabled?: boolean; path?: string; label?: string; required?: boolean; depth?: number
}) {
  const id = useId()
  const title = schema.title || label || path
  const hintId = `${id}-hint`
  const props = { id, disabled, 'aria-describedby': schema.description ? hintId : undefined }
  const description = schema.description && <p id={hintId} className="text-xs text-muted-foreground break-words">{schema.description}</p>
  const secret = secretPaths.includes(path)
  if (depth > 20 || !schema || typeof schema !== 'object') return <p role="alert">{labels.unsupported}</p>
  if (secret) {
    // Existing values (including masks) are never rendered into the password input.
    return <SecretField title={title} value={value} onChange={onChange} labels={labels} disabled={disabled} />
  }
  if (!required && value === undefined) return <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm"><span className="break-all">{title} · {labels.optional}</span><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(defaultValue(schema))} leftIcon={<Plus className="h-4 w-4" />}>{labels.add}</Button></div>
  if (schema.type === 'object') {
    const object = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    return <fieldset disabled={disabled} className="min-w-0 space-y-4 rounded-lg border border-border p-3">
      {title && <legend className="max-w-full px-1 text-sm font-medium break-words">{title}</legend>}{description}
      {Object.entries(schema.properties ?? {}).map(([key, child]) => <PluginConfigFields key={key} schema={child} value={object[key]} label={key} required={schema.required?.includes(key) ?? false} secretPaths={secretPaths} labels={labels} disabled={disabled} path={pointerChild(path, key)} depth={depth + 1} onChange={(next) => {
        const copy = { ...object }
        if (next === undefined) delete copy[key]
        else Object.defineProperty(copy, key, { value: next, enumerable: true, configurable: true, writable: true })
        onChange(copy)
      }} />)}
    </fieldset>
  }
  if (schema.type === 'array') {
    const items = Array.isArray(value) ? value : []
    const locked = secretPaths.some((secretPath) => secretPath.startsWith(`${path}/`))
    return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-lg border border-border p-3"><legend className="max-w-full px-1 text-sm font-medium break-words">{title}</legend>{description}
      {locked && <p className="text-xs text-muted-foreground">{labels.arraySecrets}</p>}
      {!schema.items ? <p role="alert">{labels.unsupported}</p> : <>{items.map((item, index) => <div key={index} className="min-w-0 space-y-2 border-b border-border pb-3"><PluginConfigFields schema={schema.items!} value={item} onChange={(next) => onChange(items.map((old, i) => i === index ? next : old))} secretPaths={secretPaths} labels={labels} disabled={disabled} path={pointerChild(path, String(index))} label={`${title} ${index + 1}`} depth={depth + 1} /><Button type="button" size="sm" variant="ghost" disabled={disabled || locked || items.length <= (schema.minItems ?? 0)} onClick={() => onChange(items.filter((_, i) => i !== index))} leftIcon={<Trash2 className="h-4 w-4" />}>{labels.remove} {index + 1}</Button></div>)}<Button type="button" size="sm" variant="outline" disabled={disabled || locked || items.length >= (schema.maxItems ?? 100)} onClick={() => onChange([...items, defaultValue(schema.items!)])} leftIcon={<Plus className="h-4 w-4" />}>{labels.add}</Button></>}
    </fieldset>
  }
  const control = schema.enum ? <select {...props} className={inputClass} required={required} value={schema.enum.findIndex((item) => JSON.stringify(item) === JSON.stringify(value))} onChange={(event) => onChange(schema.enum![Number(event.target.value)])}><option value={-1} disabled>—</option>{schema.enum.map((item, index) => <option key={index} value={index}>{String(item)}</option>)}</select>
    : schema.type === 'boolean' ? <button {...props} type="button" role="switch" aria-checked={value === true} aria-labelledby={`${id}-label`} onClick={() => onChange(value !== true)} className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border p-1 focus-visible:ring-2 focus-visible:ring-ring ${value === true ? 'bg-primary' : 'bg-muted'}`}><span className={`h-5 w-5 rounded-full bg-background transition-transform ${value === true ? 'translate-x-5' : ''}`} /></button>
    : ['string', 'number', 'integer'].includes(schema.type ?? '') ? <input {...props} className={inputClass} type={schema.type === 'string' ? 'text' : 'number'} value={typeof value === 'string' || typeof value === 'number' ? value : ''} required={required} min={schema.minimum} max={schema.maximum} minLength={schema.minLength} maxLength={schema.maxLength} step={schema.type === 'integer' ? 1 : 'any'} onChange={(event) => onChange(schema.type === 'string' ? event.target.value : event.target.value === '' ? undefined : event.target.valueAsNumber)} />
    : <p role="alert">{labels.unsupported}</p>
  return <div className="min-w-0 space-y-1"><label id={`${id}-label`} htmlFor={id} className="block text-sm font-medium break-words">{title}{required ? ' *' : ''}</label>{control}{description}</div>
}

function SecretField({ title, value, onChange, labels, disabled }: { title: string; value: unknown; onChange: (value: unknown) => void; labels: ConfigLabels; disabled: boolean }) {
  // Store the starting mask, never plaintext; the API returns masked configuration only.
  const [initial] = useState(value)
  const [mode, setMode] = useState('keep')
  const [draft, setDraft] = useState('')
  const id = useId()
  return <div className="min-w-0 space-y-2"><label htmlFor={id} className="block text-sm font-medium break-words">{title} · {labels.masked}</label><select id={id} disabled={disabled} value={mode} className={inputClass} onChange={(event) => {
    const next = event.target.value
    setMode(next); setDraft(''); onChange(next === 'keep' ? initial : next === 'clear' ? null : '')
  }}><option value="keep">{labels.keep}</option><option value="replace">{labels.replace}</option><option value="clear">{labels.clear}</option></select>{mode === 'replace' && <input aria-label={title} disabled={disabled} className={inputClass} type="password" autoComplete="new-password" required value={draft} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value) }} />}</div>
}
