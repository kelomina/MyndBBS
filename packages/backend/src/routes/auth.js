"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../controllers/auth");
const register_1 = require("../controllers/register");
const captcha_1 = require("../controllers/captcha");
const router = (0, express_1.Router)();
// Rate limiting for auth routes
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    message: { error: 'Too many requests from this IP, please try again later.' }
});
const strictAuthLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    message: { error: 'Too many requests from this IP, please try again later.' }
});
router.use(authLimiter);
// Captcha
router.get('/captcha', captcha_1.generateCaptcha);
router.post('/captcha/verify', captcha_1.verifyCaptcha);
// Auth
router.post('/register', strictAuthLimiter, register_1.registerUser);
router.post('/login', strictAuthLimiter, register_1.loginUser);
router.post('/refresh', strictAuthLimiter, register_1.refreshToken);
router.post('/register/challenge', auth_1.generateRegisterChallenge);
router.post('/register/challenge/verify', auth_1.verifyRegisterChallenge);
exports.default = router;
//# sourceMappingURL=auth.js.map