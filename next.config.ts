import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't expose "X-Powered-By: Next.js" header in responses
  poweredByHeader: false,

  // Keep response compression on (default true, stated explicitly for clarity)
  compress: true,

  // Prevent xlsx from being bundled into the server-side (Edge/Node) bundle
  // when imported by client components — it should only land in browser chunks.
  serverExternalPackages: ["xlsx"],

  // Treat all TypeScript errors as build errors (default in production builds)
  typescript: {
    ignoreBuildErrors: false,
  },

};

export default nextConfig;
