import { CaptchaChallenge } from '../src/domain/identity/CaptchaChallenge';

describe('CaptchaChallenge Domain Entity', () => {
  const createValidDragPath = (targetPosition: number): { x: number; y: number; t: number }[] => {
    const path: { x: number; y: number; t: number }[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      path.push({
        x: Math.round(progress * targetPosition),
        y: 50 + Math.sin(progress * Math.PI) * 10 + (Math.random() - 0.5) * 5,
        t: i * 50
      });
    }
    return path;
  };

  describe('create', () => {
    it('should create a valid CaptchaChallenge', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      expect(challenge.id).toBe('captcha-123');
      expect(challenge.targetPosition).toBe(150);
      expect(challenge.verified).toBe(false);
      expect(challenge.expiresAt).toEqual(expiresAt);
    });

    it('should throw error when target position is negative', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      expect(() => CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: -10,
        verified: false,
        expiresAt
      })).toThrow('ERR_INVALID_TARGET_POSITION');
    });

    it('should throw error when expiresAt is in the past', () => {
      const expiresAt = new Date(Date.now() - 1000);

      expect(() => CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      })).toThrow('ERR_CAPTCHA_ALREADY_EXPIRED');
    });
  });

  describe('verifyTrajectory', () => {
    it('should verify a valid human-like drag trajectory', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      const dragPath = createValidDragPath(150);

      expect(() => challenge.verifyTrajectory(dragPath, 1000, 150)).not.toThrow();
      expect(challenge.verified).toBe(true);
    });

    it('should throw error when challenge is expired', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      challenge['props'].expiresAt = new Date(Date.now() - 1000);

      const dragPath = createValidDragPath(150);

      expect(() => challenge.verifyTrajectory(dragPath, 1000, 150)).toThrow('ERR_CAPTCHA_EXPIRED');
    });

    it('should throw error when challenge is already verified', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: true,
        expiresAt
      });

      const dragPath = createValidDragPath(150);

      expect(() => challenge.verifyTrajectory(dragPath, 1000, 150)).toThrow('ERR_CAPTCHA_ALREADY_VERIFIED');
    });

    it('should throw error when drag path is too short', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      const shortPath = [{ x: 0, y: 50, t: 0 }, { x: 150, y: 50, t: 500 }];

      expect(() => challenge.verifyTrajectory(shortPath, 500, 150)).toThrow('ERR_AUTOMATION_DETECTED_INVALID_PATH');
    });

    it('should throw error when drag time is too short', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      const dragPath = createValidDragPath(150);

      expect(() => challenge.verifyTrajectory(dragPath, 100, 150)).toThrow('ERR_AUTOMATION_DETECTED_INVALID_PATH');
    });

    it('should throw error when drag time is too long', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      const dragPath = createValidDragPath(150);

      expect(() => challenge.verifyTrajectory(dragPath, 15000, 150)).toThrow('ERR_AUTOMATION_DETECTED_INVALID_PATH');
    });

    it('should throw error for perfectly linear trajectory (bot-like)', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      const botPath: { x: number; y: number; t: number }[] = [];
      for (let i = 0; i <= 20; i++) {
        botPath.push({ x: i * 7.5, y: 50, t: i * 50 });
      }

      expect(() => challenge.verifyTrajectory(botPath, 1000, 150)).toThrow('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY');
    });

    it('should throw error when final position is outside tolerance', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      const dragPath = createValidDragPath(150);

      expect(() => challenge.verifyTrajectory(dragPath, 1000, 120)).toThrow('ERR_INVALID_POSITION');
    });
  });

  describe('validateForConsumption', () => {
    it('should pass validation for verified and non-expired challenge', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: true,
        expiresAt
      });

      expect(() => challenge.validateForConsumption()).not.toThrow();
    });

    it('should throw error when challenge is not verified', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: false,
        expiresAt
      });

      expect(() => challenge.validateForConsumption()).toThrow('ERR_CAPTCHA_NOT_VERIFIED');
    });

    it('should throw error when challenge is expired', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = CaptchaChallenge.create({
        id: 'captcha-123',
        targetPosition: 150,
        verified: true,
        expiresAt
      });

      challenge['props'].expiresAt = new Date(Date.now() - 1000);

      expect(() => challenge.validateForConsumption()).toThrow('ERR_CAPTCHA_EXPIRED');
    });
  });
});