import { UserStatus, PostStatus } from '../src/enums'

describe('UserStatus enum', () => {
  it('should contain all 5 expected statuses', () => {
    expect(UserStatus.ACTIVE).toBe('ACTIVE')
    expect(UserStatus.INACTIVE).toBe('INACTIVE')
    expect(UserStatus.SUSPENDED).toBe('SUSPENDED')
    expect(UserStatus.BANNED).toBe('BANNED')
    expect(UserStatus.PENDING).toBe('PENDING')
  })

  it('should have unique values for all statuses', () => {
    const values = Object.values(UserStatus)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('should have 5 members', () => {
    expect(Object.keys(UserStatus).length).toBe(5)
  })
})

describe('PostStatus enum', () => {
  it('should contain all 7 expected statuses', () => {
    expect(PostStatus.DRAFT).toBe('DRAFT')
    expect(PostStatus.PUBLISHED).toBe('PUBLISHED')
    expect(PostStatus.ARCHIVED).toBe('ARCHIVED')
    expect(PostStatus.HIDDEN).toBe('HIDDEN')
    expect(PostStatus.PINNED).toBe('PINNED')
    expect(PostStatus.DELETED).toBe('DELETED')
    expect(PostStatus.PENDING).toBe('PENDING')
  })

  it('should have unique values for all statuses', () => {
    const values = Object.values(PostStatus)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('should have 7 members', () => {
    expect(Object.keys(PostStatus).length).toBe(7)
  })
})
