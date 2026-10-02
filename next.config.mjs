/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces .next/standalone — a self-contained server for the Docker image.
  output: 'standalone',
  // node:sqlite is a Node builtin; keep server code out of the bundler's way.
  serverExternalPackages: [],
};

export default nextConfig;
