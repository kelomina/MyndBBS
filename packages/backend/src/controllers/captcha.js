"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCaptcha = exports.generateCaptcha = void 0;
const db_1 = require("../db");
const generateCaptcha = async (req, res) => {
    try {
        // Assuming a track width of 300px and target width of 60px.
        // Position between 80 and 240
        const targetPosition = Math.floor(Math.random() * (240 - 80 + 1)) + 80;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        const challenge = await db_1.prisma.captchaChallenge.create({
            data: {
                targetPosition,
                expiresAt
            }
        });
        res.json({ captchaId: challenge.id });
    }
    catch (error) {
        console.error("Error generating captcha:", error);
        res.status(500).json({ error: 'Failed to generate captcha', details: String(error) });
    }
};
exports.generateCaptcha = generateCaptcha;
const verifyCaptcha = async (req, res) => {
    try {
        const { captchaId, dragPath, totalDragTime, finalPosition } = req.body;
        if (!captchaId || !dragPath || !totalDragTime || finalPosition === undefined) {
            res.status(400).json({ success: false, error: 'Missing parameters' });
            return;
        }
        const challenge = await db_1.prisma.captchaChallenge.findUnique({
            where: { id: captchaId }
        });
        if (!challenge) {
            res.status(404).json({ success: false, error: 'Challenge not found' });
            return;
        }
        if (challenge.expiresAt < new Date()) {
            res.status(400).json({ success: false, error: 'Challenge expired' });
            return;
        }
        // Automation Check 1 & 2
        if (totalDragTime < 200 || dragPath.length < 8) {
            res.status(400).json({ success: false, error: 'Automation detected (Speed/Points)' });
            return;
        }
        // Automation Check 3: Variance
        let timeIntervals = [];
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
        const TARGET_CENTER_OFFSET = 30; // 60 / 2
        const VALIDATION_TOLERANCE = 35;
        const sliderCenter = finalPosition + SLIDER_CENTER_OFFSET;
        const targetCenter = challenge.targetPosition + TARGET_CENTER_OFFSET;
        const centerOffset = Math.abs(sliderCenter - targetCenter);
        if (centerOffset > VALIDATION_TOLERANCE) {
            res.status(400).json({ success: false, error: 'Position mismatch' });
            return;
        }
        // Mark as verified
        await db_1.prisma.captchaChallenge.update({
            where: { id: captchaId },
            data: { verified: true }
        });
        res.json({ success: true, message: 'Verification passed' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Server error during verification' });
    }
};
exports.verifyCaptcha = verifyCaptcha;
//# sourceMappingURL=captcha.js.map