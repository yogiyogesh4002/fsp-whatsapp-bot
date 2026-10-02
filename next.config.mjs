/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Neon driver speaks HTTP, so there is nothing to mark external.
  serverExternalPackages: [],
};

export default nextConfig;
