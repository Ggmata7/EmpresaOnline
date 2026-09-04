import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite carregar imagens de qualquer CDN de marketplace
      },
    ],
  },
};

export default nextConfig;
