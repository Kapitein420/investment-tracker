/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // pdfjs-dist resolves its "fake worker" by dynamic-requiring
    // pdf.worker.mjs at runtime. When webpack bundles it, that path
    // disappears and the scanner crashes with
    // "Cannot find module '...pdf.worker.mjs'". Externalising it
    // means Node resolves the package from node_modules at runtime,
    // so the worker file is right next to the main module.
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS: force HTTPS for 2 years, including subdomains. Required for preload list.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
