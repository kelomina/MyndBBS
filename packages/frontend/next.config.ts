import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  /**
     * Callers: []
     * Callees: []
     * Description: Handles the rewrites logic for the application.
     * Keywords: rewrites, auto-annotated
     */
    async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3001/uploads/:path*',
      },
    ]
  }
};

export default nextConfig;
