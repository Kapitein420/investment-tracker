/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // IMs and large NDAs are commonly 5-10MB; the 2MB default rejected
      // them with FUNCTION_PAYLOAD_TOO_LARGE. Vercel's hard ceiling for a
      // serverless function body is 4.5MB on Hobby and 50MB on Pro/Enterprise,
      // so 25MB is safe across plans and gives headroom for property decks.
      bodySizeLimit: "25mb",
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
    // CSP shipped in Report-Only first so we can observe violations
    // (Next.js inlines hydration JS, sonner toasts inject styles, etc.)
    // without breaking real users while we tune the policy. Promote to
    // enforced `Content-Security-Policy` once the report stream is clean.
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.eu.mailgun.net https://api.mailgun.net",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS: force HTTPS for 2 years, including subdomains. Required for preload list.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
