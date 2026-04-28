/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // pdfjs-dist resolves its "fake worker" by dynamic-requiring
    // pdf.worker.mjs at runtime; @napi-rs/canvas is loaded the same
    // dynamic way for the DOMMatrix polyfill. Webpack bundling rewrites
    // both paths and Vercel's file tracer skips the dynamically-required
    // files, so the scanner crashes with "Cannot find module ..." in
    // production.
    //
    // serverComponentsExternalPackages: tell Next not to bundle the
    //   packages — they load straight from node_modules at runtime.
    // outputFileTracingIncludes: tell Vercel's tracer to ship the worker
    //   file and napi-rs/canvas binaries even though nothing statically
    //   imports them, so they're present in /var/task/node_modules.
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  },
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
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
