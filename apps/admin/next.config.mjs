/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Admin panel is internal tooling; don't block builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
