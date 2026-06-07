import dns from 'dns/promises'
import net from 'net'

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.lan']

function normalizeHost(host: string): string {
  return host.trim().replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
}

function ipv4ToInt(host: string): number | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null
  }
  return (((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!) >>> 0
}

function isIpv4InRange(ip: number, start: string, end: string): boolean {
  const startInt = ipv4ToInt(start)
  const endInt = ipv4ToInt(end)
  return startInt !== null && endInt !== null && ip >= startInt && ip <= endInt
}

export function isBlockedIpAddress(address: string): boolean {
  const normalized = normalizeHost(address)
  const version = net.isIP(normalized)

  if (version === 4) {
    const ip = ipv4ToInt(normalized)
    if (ip === null) return true
    const blockedIpv4Ranges: Array<[string, string]> = [
      ['0.0.0.0', '0.255.255.255'],
      ['10.0.0.0', '10.255.255.255'],
      ['100.64.0.0', '100.127.255.255'],
      ['127.0.0.0', '127.255.255.255'],
      ['169.254.0.0', '169.254.255.255'],
      ['172.16.0.0', '172.31.255.255'],
      ['192.0.0.0', '192.0.0.255'],
      ['192.0.2.0', '192.0.2.255'],
      ['192.168.0.0', '192.168.255.255'],
      ['198.18.0.0', '198.19.255.255'],
      ['198.51.100.0', '198.51.100.255'],
      ['203.0.113.0', '203.0.113.255'],
      ['224.0.0.0', '255.255.255.255'],
    ]
    return blockedIpv4Ranges.some(([start, end]) => isIpv4InRange(ip, start, end))
  }

  if (version === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      normalized.startsWith('ff')
    )
  }

  return false
}

export function assertAllowedOutboundHost(host: string): string {
  const normalized = normalizeHost(host)
  if (!normalized || /\s/.test(normalized)) {
    throw new Error('ERR_OUTBOUND_HOST_NOT_ALLOWED')
  }
  if (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix)) ||
    isBlockedIpAddress(normalized)
  ) {
    throw new Error('ERR_OUTBOUND_HOST_NOT_ALLOWED')
  }
  return normalized
}

export async function assertAllowedResolvedHost(host: string): Promise<void> {
  const normalized = assertAllowedOutboundHost(host)
  if (net.isIP(normalized)) return

  const results = await dns.lookup(normalized, { all: true, verbatim: true })
  if (results.length === 0 || results.some((result) => isBlockedIpAddress(result.address))) {
    throw new Error('ERR_OUTBOUND_HOST_NOT_ALLOWED')
  }
}
