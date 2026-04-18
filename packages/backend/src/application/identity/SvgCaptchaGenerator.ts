export class SvgCaptchaGenerator {
  public static generateImage(targetPosition: number): string {
    const cx = targetPosition + 24;
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
    return `data:image/svg+xml;base64,${bgBase64}`;
  }
}
