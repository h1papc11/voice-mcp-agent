/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
  },
  turbopack: {},
};

module.exports = nextConfig;
