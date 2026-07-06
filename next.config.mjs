/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
