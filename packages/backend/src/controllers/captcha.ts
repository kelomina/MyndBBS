import { Request, Response } from 'express';
import { authApplicationService } from '../registry';

/**
 * 函数名称：generateCaptcha
 *
 * 函数作用：
 *   生成滑块验证码挑战——生成随机目标位置，返回 SVG 图片和验证码 ID。
 * Purpose:
 *   Generates a slider captcha challenge — creates a random target position,
 *   returns an SVG image and captcha ID.
 *
 * 调用方 / Called by:
 *   GET /api/v1/auth/captcha
 *
 * 被调用方 / Calls:
 *   - authApplicationService.generateCaptcha
 *
 * 参数说明 / Parameters:
 *   无
 *
 * 返回值说明 / Returns:
 *   200: { captchaId: string, image: string } 验证码 ID 和 SVG 图片
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_FAILED_TO_GENERATE_CAPTCHA
 *
 * 副作用 / Side effects:
 *   写数据库——创建 CaptchaChallenge 记录
 *
 * 中文关键词：
 *   验证码，滑块验证，SVG，人机校验
 * English keywords:
 *   captcha, slider verification, SVG, bot detection
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
 * 函数名称：verifyCaptcha
 *
 * 函数作用：
 *   验证滑块验证码——校验用户的拖拽轨迹、总拖拽时间和最终位置。
 * Purpose:
 *   Verifies a slider captcha — validates the user's drag trajectory, total drag time, and final position.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/captcha/verify
 *
 * 被调用方 / Calls:
 *   - authApplicationService.verifyCaptcha
 *
 * 参数说明 / Parameters:
 *   - req.body.captchaId: string, 验证码 ID
 *   - req.body.dragPath: array, 拖拽路径点数组 [{x, y, time}]
 *   - req.body.totalDragTime: number, 总拖拽时间（毫秒）
 *   - req.body.finalPosition: number, 最终滑块位置
 *
 * 返回值说明 / Returns:
 *   200: { success: true, message: string }
 *   400: { success: false, error: errorCode }
 *   500: { success: false, error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_ 前缀错误码（验证码无效、已过期、轨迹异常等）
 *   - 400: ERR_MISSING_PARAMETERS
 *   - 500: ERR_SERVER_ERROR_DURING_VERIFICATION
 *
 * 副作用 / Side effects:
 *   写数据库——更新验证码状态为已验证
 *
 * 中文关键词：
 *   验证码，滑块验证，轨迹校验，人机验证
 * English keywords:
 *   captcha, slider verification, trajectory validation, bot detection
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
