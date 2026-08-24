export { proxy } from './middleware/index';

export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/pwa).*)',
    ],
};
