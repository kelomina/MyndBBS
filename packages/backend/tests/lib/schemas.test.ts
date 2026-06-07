import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  dbConfigSchema,
  domainConfigSchema,
  changeUserRoleSchema,
  changeUserStatusSchema,
  createTestAccountSchema,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  updatePostStatusSchema,
  createCategorySchema,
  updateCategorySchema,
  emailConfigSchema,
  emailTemplateSchema,
  testEmailSchema,
  sendMessageSchema,
  createWikiSchema,
  createWikiPageSchema,
} from '../../src/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test@1234',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('ERR_INVALID_EMAIL');
    });

    it('should reject short password', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: 'T@1',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak password without special characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test1234',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('ERR_PASSWORD_WEAK');
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const result = loginSchema.safeParse({ password: 'password123' });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'invalid-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate valid reset password data', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'reset-token-123',
        password: 'Test@1234',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing token', () => {
      const result = resetPasswordSchema.safeParse({ password: 'Test@1234' });
      expect(result.success).toBe(false);
    });
  });

  describe('dbConfigSchema', () => {
    it('should validate valid database config', () => {
      const result = dbConfigSchema.safeParse({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'mydb',
      });
      expect(result.success).toBe(true);
    });

    it('should accept port as string', () => {
      const result = dbConfigSchema.safeParse({
        host: 'localhost',
        port: '5432',
        username: 'postgres',
        password: 'password',
        database: 'mydb',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid port', () => {
      const result = dbConfigSchema.safeParse({
        host: 'localhost',
        port: 70000,
        username: 'postgres',
        password: 'password',
        database: 'mydb',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createPostSchema', () => {
    it('should validate valid post data', () => {
      const result = createPostSchema.safeParse({
        title: 'Test Post',
        content: 'This is a test post content',
        categoryId: 'cat-1',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(true);
    });

    it('should validate post with captcha', () => {
      const result = createPostSchema.safeParse({
        title: 'Test Post',
        content: 'This is a test post content',
        categoryId: 'cat-1',
        captchaId: 'captcha-123',
        captchaCode: '1234',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing title', () => {
      const result = createPostSchema.safeParse({
        content: 'This is a test post content',
        categoryId: 'cat-1',
      });
      expect(result.success).toBe(false);
    });

    it('should reject too long title', () => {
      const result = createPostSchema.safeParse({
        title: 'a'.repeat(201),
        content: 'Content',
        categoryId: 'cat-1',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject too long content', () => {
      const result = createPostSchema.safeParse({
        title: 'Test Post',
        content: 'a'.repeat(50001),
        categoryId: 'cat-1',
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(false);
    });

    it('should require captchaId for post creation', () => {
      const result = createPostSchema.safeParse({
        title: 'Test Post',
        content: 'Content',
        categoryId: 'cat-1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('post and comment write schemas', () => {
    it('should validate post update payloads', () => {
      const result = updatePostSchema.safeParse({
        title: 'Updated',
        content: 'Updated content',
        categoryId: 'cat-1',
      });
      expect(result.success).toBe(true);
    });

    it('should validate comment creation payloads', () => {
      const result = createCommentSchema.safeParse({
        content: 'Comment',
        parentId: null,
        captchaId: 'captcha-123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty comment updates', () => {
      const result = updateCommentSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('createCategorySchema', () => {
    it('should validate valid category data', () => {
      const result = createCategorySchema.safeParse({
        name: 'Test Category',
        description: 'A test category',
        sortOrder: 1,
        minLevel: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields as null', () => {
      const result = createCategorySchema.safeParse({
        name: 'Test Category',
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const result = createCategorySchema.safeParse({ description: 'A test' });
      expect(result.success).toBe(false);
    });

    it('should reject negative sortOrder', () => {
      const result = createCategorySchema.safeParse({
        name: 'Test Category',
        sortOrder: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('emailConfigSchema', () => {
    it('should validate valid SMTP config', () => {
      const result = emailConfigSchema.safeParse({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'user@example.com',
        pass: 'password',
        from: 'noreply@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept port as string', () => {
      const result = emailConfigSchema.safeParse({
        host: 'smtp.example.com',
        port: '587',
        from: 'noreply@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing from field', () => {
      const result = emailConfigSchema.safeParse({
        host: 'smtp.example.com',
        port: 587,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('emailTemplateSchema', () => {
    it('should validate valid email template', () => {
      const result = emailTemplateSchema.safeParse({
        type: 'welcome',
        subject: 'Welcome',
        textBody: 'Welcome text',
        htmlBody: '<html>Welcome</html>',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const result = emailTemplateSchema.safeParse({
        type: 'welcome',
        subject: 'Welcome',
        textBody: 'Welcome text',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('testEmailSchema', () => {
    it('should validate valid test email request', () => {
      const result = testEmailSchema.safeParse({
        targetEmail: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid target email', () => {
      const result = testEmailSchema.safeParse({
        targetEmail: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional smtpConfig', () => {
      const result = testEmailSchema.safeParse({
        targetEmail: 'test@example.com',
        smtpConfig: {
          host: 'smtp.example.com',
          port: 587,
          from: 'test@example.com',
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('changeUserRoleSchema', () => {
    it('should validate valid role change', () => {
      const result = changeUserRoleSchema.safeParse({
        role: 'MODERATOR',
        level: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should validate role change without optional level', () => {
      const result = changeUserRoleSchema.safeParse({
        role: 'USER',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing role', () => {
      const result = changeUserRoleSchema.safeParse({ level: 1 });
      expect(result.success).toBe(false);
    });

    it('should reject negative level', () => {
      const result = changeUserRoleSchema.safeParse({
        role: 'USER',
        level: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changeUserStatusSchema', () => {
    it('should validate valid status change', () => {
      const result = changeUserStatusSchema.safeParse({ status: 'ACTIVE' });
      expect(result.success).toBe(true);
    });

    it('should reject missing status', () => {
      const result = changeUserStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty status', () => {
      const result = changeUserStatusSchema.safeParse({ status: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('createTestAccountSchema', () => {
    it('should validate valid test account creation data', () => {
      const result = createTestAccountSchema.safeParse({
        username: 'test_qa01',
        email: 'test_qa01@example.test',
        password: 'TestPass1!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject usernames without the test prefix', () => {
      const result = createTestAccountSchema.safeParse({
        username: 'qa01',
        email: 'test_qa01@example.test',
        password: 'TestPass1!',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('ERR_TEST_ACCOUNT_USERNAME_MUST_START_WITH_TEST_PREFIX');
    });

    it('should reject weak test account passwords', () => {
      const result = createTestAccountSchema.safeParse({
        username: 'test_qa01',
        email: 'test_qa01@example.test',
        password: 'weakpass',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePostStatusSchema', () => {
    it('should validate valid status update', () => {
      const result = updatePostStatusSchema.safeParse({ status: 'PUBLISHED' });
      expect(result.success).toBe(true);
    });

    it('should reject missing status', () => {
      const result = updatePostStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateCategorySchema', () => {
    it('should validate valid partial update', () => {
      const result = updateCategorySchema.safeParse({
        name: 'Updated Category',
      });
      expect(result.success).toBe(true);
    });

    it('should validate empty update (all optional)', () => {
      const result = updateCategorySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid minLevel', () => {
      const result = updateCategorySchema.safeParse({
        minLevel: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject too long name', () => {
      const result = updateCategorySchema.safeParse({
        name: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('verifyEmailSchema', () => {
    it('should validate valid token', () => {
      const result = verifyEmailSchema.safeParse({ token: 'valid-token-123' });
      expect(result.success).toBe(true);
    });

    it('should reject missing token', () => {
      const result = verifyEmailSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty token', () => {
      const result = verifyEmailSchema.safeParse({ token: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('domainConfigSchema', () => {
    it('should validate valid domain config', () => {
      const result = domainConfigSchema.safeParse({
        protocol: 'https',
        hostname: 'example.com',
        rpId: 'example.com',
        reverseProxyMode: true,
      });
      expect(result.success).toBe(true);
    });

    it('should validate partial config', () => {
      const result = domainConfigSchema.safeParse({ hostname: 'example.com' });
      expect(result.success).toBe(true);
    });

    it('should validate empty config', () => {
      const result = domainConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid protocol', () => {
      const result = domainConfigSchema.safeParse({
        protocol: 'ftp',
      } as any);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases for all schemas', () => {
    it('should handle null values appropriately', () => {
      const result = createCategorySchema.safeParse({
        name: 'Test',
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it('should handle undefined values appropriately', () => {
      const result = createPostSchema.safeParse({
        title: 'Test',
        content: 'Content',
        categoryId: 'cat-1',
        captchaId: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('should reject extra fields', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password',
        extraField: 'value',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('message schemas', () => {
    it('should validate encrypted message sends', () => {
      const result = sendMessageSchema.safeParse({
        receiverId: 'receiver-1',
        encryptedContent: 'ciphertext',
        ephemeralPublicKey: 'ephemeral-key',
        senderEncryptedContent: 'sender-ciphertext',
        isTimedMessage: true,
        expiresIn: 60000,
        autoDeleteForSelf: false,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid timed message expiration', () => {
      const result = sendMessageSchema.safeParse({
        receiverId: 'receiver-1',
        encryptedContent: 'ciphertext',
        ephemeralPublicKey: 'ephemeral-key',
        expiresIn: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('wiki schemas', () => {
    it('should validate wiki creation payloads', () => {
      const result = createWikiSchema.safeParse({
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
      });
      expect(result.success).toBe(true);
    });

    it('should validate wiki page creation payloads', () => {
      const result = createWikiPageSchema.safeParse({
        title: 'Page',
        content: 'Content',
        slug: 'page',
        parentId: null,
      });
      expect(result.success).toBe(true);
    });
  });
});
