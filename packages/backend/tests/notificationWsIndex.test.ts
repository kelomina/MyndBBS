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

  it('registration delegates to the purpose-bound verification port, not solver algorithms', () => {
    const authService = fs.readFileSync(
      path.join(__dirname, '../src/application/identity/AuthApplicationService.ts'),
      'utf8',
    )
    expect(authService).toContain("this.opts.humanVerification.requires('registration')")
    expect(authService).toContain('this.opts.humanVerification.consumeProof(')
    expect(authService).toContain("consumeProof(captchaId, 'registration')")
    expect(authService).not.toContain('verifyTrajectoryForUnlock')
    expect(authService).not.toContain('challengeKind')
  })
})
