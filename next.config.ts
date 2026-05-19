import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There's a stray /Users/vera/package-lock.json at home. Without this,
  // Next.js infers /Users/vera as the workspace root and mis-locates the
  // .next directory under certain operations.
  outputFileTracingRoot: __dirname,

  // Emotion SWC transform: lets the EmotionRegistry SSR setup work cleanly
  // under both webpack and Turbopack without a babel config.
  compiler: {
    emotion: true,
  },
};

export default nextConfig;
