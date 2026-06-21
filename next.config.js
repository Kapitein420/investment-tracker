/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // NOTE: this only raises Next.js's own request-body check. Vercel's
      // platform gateway hard-caps Function request bodies at 4.5MB on
      // every plan (Hobby/Pro/Enterprise) — see
      // https://vercel.com/docs/functions/limitations#request-body-size.
      // Anything bigger gets a 413 before our code runs, regardless of
      // this setting. Large attachments (IMs, full-res property photos)
      // upload direct-to-Supabase via createContentUploadUrl instead, so
      // the bytes never traverse a Vercel Function. This limit only
      // matters for the legacy uploadContentFile fallback path and small
      // server-action form posts.
      bodySizeLimit: "10mb",
      // Next.js 14 rejects any server-action POST where the Origin header
      // doesn't match an allow-listed host. Without this, custom domains
      // silently break every upload / save / sign action — the request
      // returns a generic "Invalid Server Action request" before it ever
      // reaches the action body.
      //
      // Include:
      //   - the bare apex (dils-investorportal.nl) for users who drop www
      //   - the canonical www host (production)
      //   - the legacy Vercel URL until DNS + bookmarks settle
      //   - *.vercel.app so preview deployments keep working
      allowedOrigins: [
        "www.dils-investorportal.nl",
        "dils-investorportal.nl",
        "investment-tracker-wd1b.vercel.app",
        "*.vercel.app",
      ],
    },
  },
  // pdfjs-dist resolves its "fake worker" by dynamic-requiring
  // pdf.worker.mjs at runtime; @napi-rs/canvas is loaded the same
  // dynamic way for the DOMMatrix polyfill. Webpack bundling rewrites
  // both paths and Vercel's file tracer skips the dynamically-required
  // files, so the scanner crashes with "Cannot find module ..." in
  // production.
  //
  // serverExternalPackages: tell Next not to bundle the packages — they
  //   load straight from node_modules at runtime. (Stable top-level key
  //   as of Next 15; was experimental.serverComponentsExternalPackages.)
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // outputFileTracingIncludes: tell Vercel's tracer to ship the worker
  //   file and napi-rs/canvas binaries even though nothing statically
  //   imports them, so they're present in /var/task/node_modules.
  //   Promoted from experimental to a stable top-level key in Next 15.
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
