import { createHash } from 'node:crypto'
import { redis } from '../../lib/redis'
import {
  verificationUnavailable,
  type VerificationRecord,
  type VerificationStore,
} from '../../application/system/HumanVerificationService'

export const TAKE_VERIFICATION_RECORD = `local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local record = cjson.decode(raw)
if type(record.deadline) ~= 'number' or record.deadline <= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return nil
end
local expected = cjson.decode(ARGV[1])
for k, v in pairs(expected) do
  if record[k] ~= v then return nil end
end
redis.call('DEL', KEYS[1])
return raw`

type RedisPort = {
  status?: string
  set(...args: Array<string | number>): Promise<unknown>
  eval(script: string, keys: number, ...args: string[]): Promise<unknown>
}
/** No memory fallback: only Redis atomically authorizes a challenge/proof once. */
export class RedisVerificationStore implements VerificationStore {
  constructor(
    private readonly client: RedisPort = redis as unknown as RedisPort,
    private readonly configured: () => boolean = () => Boolean(process.env.REDIS_URL),
  ) {}
  private key(kind: 'challenge' | 'proof', handle: string): string {
    return (
      'myndbbs:verification:v1:' + kind + ':' + createHash('sha256').update(handle).digest('hex')
    )
  }
  private async request<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.configured() || (this.client.status && this.client.status !== 'ready'))
      throw verificationUnavailable()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(verificationUnavailable()), 5000)
        }),
      ])
    } catch {
      throw verificationUnavailable()
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  async put(
    kind: 'challenge' | 'proof',
    handle: string,
    record: VerificationRecord,
    ttlSec: number,
  ): Promise<void> {
    const result = await this.request(() =>
      this.client.set(
        this.key(kind, handle),
        JSON.stringify(record),
        'EX',
        Math.max(1, Math.min(300, ttlSec)),
        'NX',
      ),
    )
    if (result !== 'OK') throw verificationUnavailable()
  }
  async take(
    kind: 'challenge' | 'proof',
    handle: string,
    expected: Record<string, string>,
    now: number,
  ): Promise<VerificationRecord | null> {
    const result = await this.request(() =>
      this.client.eval(
        TAKE_VERIFICATION_RECORD,
        1,
        this.key(kind, handle),
        JSON.stringify(expected),
        String(now),
      ),
    )
    if (result === null) return null
    if (typeof result !== 'string') throw verificationUnavailable()
    try {
      return JSON.parse(result) as VerificationRecord
    } catch {
      throw verificationUnavailable()
    }
  }
}
