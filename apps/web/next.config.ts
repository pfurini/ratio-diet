import '@ratio-diet/env/web';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['shiki'],
  typedRoutes: true,
};

export default nextConfig;
