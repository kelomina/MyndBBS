// Migrated unchanged algorithm from pre-change application/identity/SvgCaptchaGenerator.ts.
// Standalone plugin-owned MJS; no runtime dependency on backend source or storage.
import { randomBytes } from 'node:crypto'
import { deflateSync } from 'node:zlib'
const WIDTH = 318
const HEIGHT = 128
const TARGET_Y = 64
const TARGET_RADIUS = 22
const TRACK_LEFT = 24
const TRACK_RIGHT = WIDTH - 24
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
function makeCrcTable() {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}
const CRC_TABLE = makeCrcTable()
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}
function writePixel(row, x, r, g, b, a) {
  const offset = 1 + x * 4
  row[offset] = r
  row[offset + 1] = g
  row[offset + 2] = b
  row[offset + 3] = a
}
function blendPixel(row, x, r, g, b, alpha) {
  const offset = 1 + x * 4
  const baseAlpha = alpha / 255
  row[offset] = Math.round(row[offset] * (1 - baseAlpha) + r * baseAlpha)
  row[offset + 1] = Math.round(row[offset + 1] * (1 - baseAlpha) + g * baseAlpha)
  row[offset + 2] = Math.round(row[offset + 2] * (1 - baseAlpha) + b * baseAlpha)
  row[offset + 3] = 255
}
function buildPng(rows) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(WIDTH, 0)
  header.writeUInt32BE(HEIGHT, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
export class SvgCaptchaGenerator {
  static generateImage(targetPosition) {
    const seed = randomBytes(32)
    const rows = []
    const targetCenter = clamp(targetPosition + 24, TRACK_LEFT, TRACK_RIGHT)
    for (let y = 0; y < HEIGHT; y++) {
      const row = Buffer.alloc(1 + WIDTH * 4)
      row[0] = 0
      for (let x = 0; x < WIDTH; x++) {
        const gradient = Math.round(18 + (x / WIDTH) * 20 + (y / HEIGHT) * 12)
        const noise = seed[(x * 17 + y * 31) % seed.length] % 18
        writePixel(row, x, gradient, gradient + noise, 46 + noise, 255)
      }
      for (let x = TRACK_LEFT; x <= TRACK_RIGHT; x++) {
        if (Math.abs(y - TARGET_Y) <= 2) {
          blendPixel(row, x, 148, 163, 184, 70)
        }
      }
      for (let x = 0; x < WIDTH; x++) {
        const dx = x - targetCenter
        const dy = y - TARGET_Y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance <= TARGET_RADIUS) {
          const edge = TARGET_RADIUS - distance
          const alpha = edge > 4 ? 115 : Math.round(edge * 26)
          blendPixel(row, x, 226, 232, 240, alpha)
        }
        if (distance > TARGET_RADIUS + 4 && distance < TARGET_RADIUS + 8) {
          blendPixel(row, x, 71, 85, 105, 80)
        }
      }
      for (let i = 0; i < seed.length; i++) {
        const dotX = (seed[i] * 37 + i * 19) % WIDTH
        const dotY = (seed[(i + 7) % seed.length] * 29 + i * 23) % HEIGHT
        if (Math.abs(dotY - y) <= 1) {
          for (let x = Math.max(0, dotX - 1); x <= Math.min(WIDTH - 1, dotX + 1); x++) {
            blendPixel(row, x, 148, 163, 184, 55)
          }
        }
      }
      rows.push(row)
    }
    return `data:image/png;base64,${buildPng(rows).toString('base64')}`
  }
}
