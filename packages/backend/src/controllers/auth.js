"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRegisterChallenge = exports.generateRegisterChallenge = void 0;
const server_1 = require("@simplewebauthn/server");
const db_1 = require("../db");
const rpName = 'MyndBBS';
const rpID = 'localhost'; // Should be domain in prod
const origin = `http://${rpID}:3000`;
const generateRegisterChallenge = async (req, res) => {
    const { email, username } = req.body;
    if (!email || !username) {
        return res.status(400).json({ code: 400, message: 'Email and username required' });
    }
    // Mock user ID generation for challenge
    const mockUserId = 'user-' + Date.now();
    const options = await (0, server_1.generateRegistrationOptions)({
        rpName,
        rpID,
        userID: new Uint8Array(Buffer.from(mockUserId)),
        userName: username,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });
    // Store in database instead of userChallenges dictionary
    await db_1.prisma.authChallenge.create({
        data: {
            id: mockUserId,
            challenge: options.challenge,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
        }
    });
    res.json({
        code: 0,
        message: 'Challenge generated',
        data: { options, mockUserId }
    });
};
exports.generateRegisterChallenge = generateRegisterChallenge;
const verifyRegisterChallenge = async (req, res) => {
    const { mockUserId, response } = req.body;
    if (!mockUserId || !response) {
        return res.status(400).json({ code: 400, message: 'Missing required fields' });
    }
    const challengeRecord = await db_1.prisma.authChallenge.findUnique({
        where: { id: mockUserId }
    });
    if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
        return res.status(400).json({ code: 400, message: 'Challenge expired or invalid' });
    }
    let verification;
    try {
        verification = await (0, server_1.verifyRegistrationResponse)({
            response,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
    }
    catch (error) {
        return res.status(400).json({ code: 400, message: error.message });
    }
    const { verified } = verification;
    if (verified) {
        // Clean up challenge after successful verification
        await db_1.prisma.authChallenge.delete({ where: { id: mockUserId } });
        return res.json({ code: 0, message: 'Registration verified successfully', data: { verified } });
    }
    return res.status(400).json({ code: 400, message: 'Registration verification failed' });
};
exports.verifyRegisterChallenge = verifyRegisterChallenge;
//# sourceMappingURL=auth.js.map