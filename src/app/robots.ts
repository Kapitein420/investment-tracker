import type { MetadataRoute } from "next";

// The portal is invite-only: nothing in it should ever appear in a search
// index. Crawling stays open for /login and /privacy so reputation scanners
// and mail filters can see who runs the site; the noindex header and meta tag
// (next.config.js, layout.tsx) keep those pages out of results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/login", "/privacy", "/.well-known/security.txt"],
        disallow: "/",
      },
    ],
  };
}
