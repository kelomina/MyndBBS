import { APP_NAME, MAX_UPLOAD_SIZE } from '../src/constants'

describe('APP_NAME', () => {
  it('should be a non-empty string', () => {
    expect(typeof APP_NAME).toBe('string')
    expect(APP_NAME.length).toBeGreaterThan(0)
  })

  it('should equal the expected application name', () => {
    expect(APP_NAME).toBe('MyndBBS')
  })
})

describe('MAX_UPLOAD_SIZE', () => {
  it('should be exactly 5 MB (5242880 bytes)', () => {
    expect(MAX_UPLOAD_SIZE).toBe(5 * 1024 * 1024)
    expect(MAX_UPLOAD_SIZE).toBe(5242880)
  })

  it('should be a positive number', () => {
    expect(MAX_UPLOAD_SIZE).toBeGreaterThan(0)
  })
})
