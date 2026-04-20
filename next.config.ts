import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'whvqqtybrmjkwiqzgvue.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Suppress Leaflet SSR warnings
  serverExternalPackages: ['leaflet'],
};

export default nextConfig;
