import { Request, Response } from 'express';
import { authApplicationService } from '../registry';

/**
 * Callers: []
 * Callees: [AuthApplicationService.generateCaptcha, json, console.error, status]
 * Description: Orchestrates the generation of a new slider captcha challenge via the AuthApplicationService and generates the SVG image.
 * Keywords: generate, captcha, challenge, identity, service
 */
export const generateCaptcha = async (req: Request, res: Response) => {
  try {
    const { id, image } = await authApplicationService.generateCaptcha();
    res.json({ captchaId: id, image });
  } catch (error) {
    console.error("Error generating captcha:", error);
    res.status(500).json({ error: 'ERR_FAILED_TO_GENERATE_CAPTCHA' });
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
