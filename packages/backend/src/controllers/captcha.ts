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
        <rect width="318" height="128" fill="#f1f5f9" />
        <text x="159" y="64" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">Security Verification</text>
        <path d="M ${targetPosition} 44 h 50 v 40 h -50 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 4" />
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
    if (totalDragTime < 200 || dragPath.length < 8) {
      res.status(400).json({ success: false, error: 'Automation detected (Speed/Points)' });
      return;
    }

    // Automation Check 3: Variance
    let timeIntervals: number[] = [];
    for (let i = 1; i < dragPath.length; i++) {
      timeIntervals.push(dragPath[i].time - dragPath[i - 1].time);
    }
    
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 1.5) {
      res.status(400).json({ success: false, error: 'Automation detected (Variance)' });
      return;
    }

    // Position Check
    const SLIDER_CENTER_OFFSET = 25; // 50 / 2
    const TARGET_CENTER_OFFSET = 25; // 50 / 2
    const VALIDATION_TOLERANCE = 35;

    // finalPosition is slider's left. The visual puzzle is at finalPosition + 8
    const sliderCenter = finalPosition + 8 + SLIDER_CENTER_OFFSET;
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
