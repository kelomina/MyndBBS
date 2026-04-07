import { Request, Response } from 'express';
import { prisma } from '../db';

export const generateCaptcha = async (req: Request, res: Response) => {
  try {
    // Assuming an inner container width of 318px.
    // Track is slightly smaller, puzzle piece visually starts at 8px.
    // Position between 80 and 240
    const targetPosition = Math.floor(Math.random() * (240 - 80 + 1)) + 80;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Periodically cleanup expired captchas to prevent database exhaustion (10% probability)
    if (Math.random() < 0.1) {
      prisma.captchaChallenge.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      }).catch(console.error);
    }

    const challenge = await prisma.captchaChallenge.create({
      data: {
        targetPosition,
        expiresAt
      }
    });

    // Generate SVG background to provide visual hint without sending the raw number
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
        <circle cx="${targetPosition + 24}" cy="64" r="20" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" filter="url(#glow)" stroke-dasharray="4 4" />
      </svg>
    `;
    const bgBase64 = Buffer.from(svgBackground).toString('base64');
    const bgUrl = `data:image/svg+xml;base64,${bgBase64}`;

    res.json({ captchaId: challenge.id, image: bgUrl });
  } catch (error) {
    console.error("Error generating captcha:", error);
    res.status(500).json({ error: 'Failed to generate captcha', details: String(error) });
  }
};

export const verifyCaptcha = async (req: Request, res: Response): Promise<void> => {
  try {
    const { captchaId, dragPath, totalDragTime, finalPosition } = req.body;

    if (!captchaId || !dragPath || !totalDragTime || finalPosition === undefined) {
      res.status(400).json({ success: false, error: 'Missing parameters' });
      return;
    }

    const challenge = await prisma.captchaChallenge.findUnique({
      where: { id: captchaId }
    });

    if (!challenge) {
      res.status(404).json({ success: false, error: 'Challenge not found' });
      return;
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.captchaChallenge.delete({ where: { id: captchaId } }).catch(() => {});
      res.status(400).json({ success: false, error: 'Challenge expired' });
      return;
    }

    // Automation Check 1 & 2
    if (totalDragTime < 200 || totalDragTime > 10000 || dragPath.length < 10) {
      res.status(400).json({ success: false, error: 'Automation detected (Speed/Points)' });
      return;
    }

    // Automation Check 3: Variance & Velocity
    let timeIntervals: number[] = [];
    let xDistances: number[] = [];
    let yVariance = 0;
    const yValues = dragPath.map((p: any) => p.y || 0);
    const avgY = yValues.reduce((a: number, b: number) => a + b, 0) / yValues.length;
    yVariance = yValues.reduce((sum: number, y: number) => sum + Math.pow(y - avgY, 2), 0) / yValues.length;

    for (let i = 1; i < dragPath.length; i++) {
      timeIntervals.push(dragPath[i].time - dragPath[i - 1].time);
      xDistances.push(Math.abs(dragPath[i].x - dragPath[i - 1].x));
    }
    
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
    const stdDev = Math.sqrt(variance);

    // Humans rarely drag perfectly straight. If variance in Y is exactly 0 and X speeds are too uniform, flag it.
    if (stdDev < 1.5 && yVariance === 0) {
      res.status(400).json({ success: false, error: 'Automation detected (Linear trajectory)' });
      return;
    }

    // Position Check for 48px Orb
    const ORB_CENTER_OFFSET = 24; // 48 / 2
    const TARGET_CENTER_OFFSET = 24; // 48 / 2
    const VALIDATION_TOLERANCE = 15; // Stricter tolerance (down from 35)

    // finalPosition is orb's left. 
    const sliderCenter = finalPosition + ORB_CENTER_OFFSET;
    const targetCenter = challenge.targetPosition + TARGET_CENTER_OFFSET;
    const centerOffset = Math.abs(sliderCenter - targetCenter);

    if (centerOffset > VALIDATION_TOLERANCE) {
      res.status(400).json({ success: false, error: 'Position mismatch' });
      return;
    }

    // Mark as verified
    await prisma.captchaChallenge.update({
      where: { id: captchaId },
      data: { verified: true }
    });

    res.json({ success: true, message: 'Verification passed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during verification' });
  }
};
