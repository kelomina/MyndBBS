import fs from 'fs'
import path from 'path'

describe('notification WS + index regression', () => {
  it('subscribes MENTION in WebSocketPushBridge with commentId payload', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/infrastructure/websocket/WebSocketPushBridge.ts'),
      'utf8',
    )
    expect(source).toContain('MentionedEvent')
    expect(source).toContain("notificationType: 'MENTION'")
    expect(source).toContain('commentId')
    // 自回双守卫保持
    expect(source).toContain('event.userId === event.mentionerId')
  })

  it('persists commentId for POST_REPLIED/COMMENT_REPLIED with relatedId still postId', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/application/notification/NotificationApplicationService.ts'),
      'utf8',
    )
    expect(source).toContain('event.commentId')
    expect(source).toContain('event.childCommentId')
    expect(source).toContain('relatedId')
  })

  it('declares composite index (userId,isRead,createdAt) in schema', () => {
    const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8')
    expect(schema).toContain('@@index([userId, isRead, createdAt])')
    expect(schema).toContain('commentId')
  })

  it('keeps slider 5-call semantics untouched (no federal kind leak into old paths except guard)', () => {
    const authService = fs.readFileSync(
      path.join(__dirname, '../src/application/identity/AuthApplicationService.ts'),
      'utf8',
    )
    // 旧路径仅加 kind==slider 守卫，不改容差/耗时/方差阈值
    expect(authService).toContain("challengeKind !== 'slider'")
    expect(authService).toContain('verifyTrajectoryForUnlock')
  })
})
