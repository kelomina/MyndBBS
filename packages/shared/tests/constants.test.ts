import * as sharedConstants from '../src/constants'
import { APP_NAME, POST_ATTACHMENT_MAX_BYTES } from '../src/constants'

describe('APP_NAME', () => {
  it('should be a non-empty string', () => {
    expect(typeof APP_NAME).toBe('string')
    expect(APP_NAME.length).toBeGreaterThan(0)
  })

  it('should equal the expected application name', () => {
    expect(APP_NAME).toBe('MyndBBS')
  })
})

describe('POST_ATTACHMENT_MAX_BYTES', () => {
  it('should be exactly 10 MiB (10485760 bytes), inclusive boundary', () => {
    expect(POST_ATTACHMENT_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(POST_ATTACHMENT_MAX_BYTES).toBe(10485760)
  })

  it('should be a positive number', () => {
    expect(POST_ATTACHMENT_MAX_BYTES).toBeGreaterThan(0)
  })

  // 防漂移（FREEZE R1/R7）：用户可见面把该常量显示为「10MB」，故它必须是整 MiB，
  // 否则前端 {maxMB} 插值会算出小数而与常量口径分叉。文案含 {maxMB} 的断言由前端测试承担。
  it('should be an exact whole number of MiB so the 10MB label cannot drift', () => {
    expect(POST_ATTACHMENT_MAX_BYTES % (1024 * 1024)).toBe(0)
    expect(POST_ATTACHMENT_MAX_BYTES / 1024 / 1024).toBe(10)
  })

  // 单一真源哨兵（FREEZE R3）：旧的全站含糊上限必须已删除，防止有人重新引用它而绕过帖子常量。
  it('should no longer export the ambiguous MAX_UPLOAD_SIZE', () => {
    expect(sharedConstants).not.toHaveProperty('MAX_UPLOAD_SIZE')
  })
})
