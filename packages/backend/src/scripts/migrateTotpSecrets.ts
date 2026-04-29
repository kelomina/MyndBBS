import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { TotpEncryptionService } from '../infrastructure/services/identity/TotpEncryptionService'

dotenv.config()

const DRY_RUN = process.argv.includes('--dry-run')

interface MigrationResult {
  totalUsers: number
  plaintextFound: number
  encrypted: number
  skippedEncrypted: number
  failed: number
  errors: string[]
}

async function migrateTotpSecrets(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalUsers: 0,
    plaintextFound: 0,
    encrypted: 0,
    skippedEncrypted: 0,
    failed: 0,
    errors: [],
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set.')
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })

  const encryptionService = new TotpEncryptionService()

  try {
    const users = await client.user.findMany({
      where: { totpSecret: { not: null } },
      select: { id: true, totpSecret: true },
    })

    result.totalUsers = users.length

    for (const user of users) {
      if (!user.totpSecret) {
        result.skippedEncrypted++
        continue
      }

      if (encryptionService.isEncrypted(user.totpSecret)) {
        result.skippedEncrypted++
        continue
      }

      result.plaintextFound++

      if (DRY_RUN) {
        console.log(`[DRY RUN] 将加密用户 ${user.id} 的 totpSecret (明文长度: ${user.totpSecret.length})`)
        console.log(`  [DRY RUN] Would encrypt totpSecret for user ${user.id}`)
        result.encrypted++
        continue
      }

      try {
        const encrypted = encryptionService.encrypt(user.totpSecret)
        await client.user.update({
          where: { id: user.id },
          data: { totpSecret: encrypted },
        })
        console.log(`已加密用户 ${user.id} 的 totpSecret`)
        console.log(`  Encrypted totpSecret for user ${user.id}`)
        result.encrypted++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`加密用户 ${user.id} 失败: ${errorMsg}`)
        console.error(`  Failed to encrypt totpSecret for user ${user.id}: ${errorMsg}`)
        result.failed++
        result.errors.push(`user ${user.id}: ${errorMsg}`)
      }
    }
  } finally {
    await pool.end()
  }

  return result
}

function printSummary(result: MigrationResult): void {
  const mode = DRY_RUN ? 'DRY RUN（模拟运行）' : '正式运行'
  console.log('')
  console.log('========================================')
  console.log(`  TOTP Secret 加密迁移报告 — ${mode}`)
  console.log('  TOTP Secret Encryption Migration Report')
  console.log('========================================')
  console.log(`  总用户数 / Total users:     ${result.totalUsers}`)
  console.log(`  发现明文 / Plaintext found:  ${result.plaintextFound}`)
  console.log(`  已加密 / Encrypted:         ${result.encrypted}`)
  console.log(`  跳过(已加密) / Skipped:     ${result.skippedEncrypted}`)
  console.log(`  失败 / Failed:              ${result.failed}`)
  if (result.errors.length > 0) {
    console.log('  错误详情 / Error details:')
    result.errors.forEach((e) => console.log(`    - ${e}`))
  }
  console.log('========================================')

  if (DRY_RUN) {
    console.log('请使用以下命令进行正式加密: ts-node src/scripts/migrateTotpSecrets.ts')
    console.log('To run for real, remove --dry-run flag: ts-node src/scripts/migrateTotpSecrets.ts')
  }
}

migrateTotpSecrets()
  .then((result) => {
    printSummary(result)
    process.exit(result.failed > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error('迁移脚本执行失败 / Migration script failed:', err)
    process.exit(1)
  })
