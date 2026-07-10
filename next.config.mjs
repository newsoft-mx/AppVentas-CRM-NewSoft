/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@sparticuz/chromium",
    "puppeteer-core",
  ],
  // El tracing de Vercel (@vercel/nft) no detecta los binarios de Chromium
  // porque @sparticuz/chromium los resuelve con fs en runtime, no con
  // import/require estático. Sin esto, /var/task/.../@sparticuz/chromium/bin
  // no existe en el deploy y executablePath() truena.
  outputFileTracingIncludes: {
    "/api/pdf/\\[id\\]": ["./node_modules/@sparticuz/chromium/**/*"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
