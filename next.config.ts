import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1440],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite carregar imagens de qualquer CDN de marketplace
      },
    ],
  },
};

export default nextConfig;
