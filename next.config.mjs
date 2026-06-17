/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@react-pdf/renderer",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
