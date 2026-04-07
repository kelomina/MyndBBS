"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCaptcha = void 0;
// Plugin pattern for captcha validation
const verifyCaptcha = async (token, ip) => {
    // TODO: Integrate actual provider like Turnstile or reCAPTCHA here
    // For development/testing, accept a mocked token 'valid-captcha-token'
    if (process.env.NODE_ENV !== 'production' && token === 'valid-captcha-token') {
        return true;
    }
    // Real verification logic goes here
    return false;
};
exports.verifyCaptcha = verifyCaptcha;
//# sourceMappingURL=captcha.js.map