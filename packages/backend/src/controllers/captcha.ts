import { Request, Response } from 'express';
import { AuthApplicationService } from '../application/identity/AuthApplicationService';
import { PrismaCaptchaChallengeRepository } from '../infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from '../infrastructure/repositories/PrismaPasskeyRepository';

const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository()
);

/**
 * Callers: []
 * Callees: [AuthApplicationService.generateCaptcha, Buffer.from, toString, json, console.error, status]
 * Description: Orchestrates the generation of a new slider captcha challenge via the AuthApplicationService and generates the SVG image.
 * Keywords: generate, captcha, challenge, identity, service
 */
export const generateCaptcha = async (req: Request, res: Response) => {
  try {
    const challenge = await authApplicationService.generateCaptcha();
    const targetPosition = challenge.targetPosition;

    // Generate SVG background with an obfuscated path instead of explicit circle cx coordinate
    const cx = targetPosition + 24;
    // We use a relatively generic path that still draws a circle but without a single clear 'cx' attribute
    const pathData = `M ${cx - 20} 64 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0`;

    const svgBackground = `
      <svg width="318" height="128" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="318" height="128" fill="url(#bg)" rx="8" />
        <text x="159" y="30" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle" letter-spacing="2">SECURITY VERIFICATION</text>
        <path d="${pathData}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" filter="url(#glow)" stroke-dasharray="4 4" />
      </svg>
    `;
    const bgBase64 = Buffer.from(svgBackground).toString('base64');
    const bgUrl = `data:image/svg+xml;base64,${bgBase64}`;

    res.json({ captchaId: challenge.id, image: bgUrl });
  } catch (error) {
    console.error("Error generating captcha:", error);
    res.status(500).json({ error: 'ERR_FAILED_TO_GENERATE_CAPTCHA' });
  }
};

/**
 * Callers: []
 * Callees: [findUnique, delete]
 * Description: Handles the verify and consume captcha logic for the application.
 * Keywords: verifyandconsumecaptcha, verify, and, consume, captcha, auto-annotated
 */
export const verifyAndConsumeCaptcha = async (captchaId: string): Promise<boolean> => {
  try {
    const challenge = await prisma.captchaChallenge.findUnique({
      where: { id: captchaId }
    });

    if (!challenge || !challenge.verified || challenge.expiresAt < new Date()) {
      return false;
    }

    await prisma.captchaChallenge.delete({ where: { id: captchaId } });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Callers: []
 * Callees: [AuthApplicationService.verifyCaptcha, json, status]
 * Description: Orchestrates the verification of a slider captcha challenge, delegating complex bot-detection heuristics to the domain layer.
 * Keywords: verify, captcha, challenge, identity, service
 */
export const verifyCaptcha = async (req: Request, res: Response): Promise<void> => {
  try {
    const { captchaId, dragPath, totalDragTime, finalPosition } = req.body;

    if (!captchaId || !dragPath || !totalDragTime || finalPosition === undefined) {
      res.status(400).json({ success: false, error: 'ERR_MISSING_PARAMETERS' });
      return;
    }

    // Map frontend 'time' to domain 't'
    const formattedDragPath = dragPath.map((p: any) => ({ x: p.x, y: p.y, t: p.time }));

    await authApplicationService.verifyCaptcha(captchaId, formattedDragPath, totalDragTime, finalPosition);

    res.json({ success: true, message: 'Verification passed' });
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: 'ERR_SERVER_ERROR_DURING_VERIFICATION' });
  }
};
