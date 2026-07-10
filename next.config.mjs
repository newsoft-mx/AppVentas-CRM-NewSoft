/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@sparticuz/chromium",
    "puppeteer-core",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
