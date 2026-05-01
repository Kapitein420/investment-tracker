import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Routes that require an authenticated session. Anything else flowing
// through this middleware (e.g. /login, /sign/[token], /forgot-password)
// runs purely for header-stripping side-effects.
function isProtected(path: string): boolean {
  if (path === "/") return true;
  return (
    path.startsWith("/assets") ||
    path.startsWith("/admin") ||
    path.startsWith("/portal")
  );
}

// Vercel's edge layer attaches `X-Matched-Path` to every response, leaking
// the file-system route shape (e.g. `/sign/[token]`, `/api/auth/[...nextauth]`)
// to anyone running curl. Stripping it from the middleware response covers
// the routes the matcher hits; Vercel may re-add it on bypassed paths, so
// this is best-effort defence-in-depth rather than a full guarantee.
// (QC finding F-06.)
function strip(res: NextResponse): NextResponse {
  res.headers.delete("x-matched-path");
  return res;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // First-login force-change-password gate. Disabled by default —
    // Noah's preference is that investors use the system-issued
    // password rather than picking their own (avoids accidental reuse
    // of personal/banking passwords).
    //
    // The /portal/change-password page itself stays available so
    // anyone who wants to change their password voluntarily still can,
    // and the schema flag is preserved so flipping this behaviour
    // back on is a one-env-var change. To re-enable: set
    // FORCE_PASSWORD_CHANGE_ON_FIRST_LOGIN=true on Vercel.
    if (
      process.env.FORCE_PASSWORD_CHANGE_ON_FIRST_LOGIN === "true" &&
      token?.mustChangePassword
    ) {
      if (
        !path.startsWith("/portal/change-password") &&
        !path.startsWith("/api/auth")
      ) {
        return strip(NextResponse.redirect(new URL("/portal/change-password", req.url)));
      }
    }

    // INVESTOR role: redirect away from admin routes to portal
    if (token?.role === "INVESTOR") {
      if (path === "/" || path.startsWith("/assets") || path.startsWith("/admin")) {
        return strip(NextResponse.redirect(new URL("/portal", req.url)));
      }
    }

    // Non-investor trying to access portal. The signed-NDA viewer
    // (/portal/signed-nda/*) is shared between INVESTOR (who signed it),
    // ADMIN / EDITOR (deal team), and VIEWER (opdrachtgever following the
    // deal) — all four hit the same page. Per-row authorisation happens in
    // getSignedHtmlNda; this is just a coarser route gate. Everywhere else
    // under /portal stays investor-only.
    if (
      path.startsWith("/portal") &&
      !path.startsWith("/portal/signed-nda") &&
      token?.role !== "INVESTOR" &&
      token?.role !== "ADMIN"
    ) {
      return strip(NextResponse.redirect(new URL("/", req.url)));
    }

    // Admin routes require ADMIN role
    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      return strip(NextResponse.redirect(new URL("/", req.url)));
    }

    return strip(NextResponse.next());
  },
  {
    callbacks: {
      // Public paths still flow through the middleware function so the
      // X-Matched-Path strip applies; only protected paths fail closed
      // when the session cookie is missing.
      authorized: ({ req, token }) =>
        !isProtected(req.nextUrl.pathname) || !!token,
    },
  }
);

export const config = {
  matcher: [
    // Match everything except Next.js internals + the NextAuth handler
    // (which manages its own response shape). Auth enforcement is gated
    // inside `authorized()` so public routes still benefit from the
    // header strip without being blocked.
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
