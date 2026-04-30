import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

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
        return NextResponse.redirect(new URL("/portal/change-password", req.url));
      }
    }

    // INVESTOR role: redirect away from admin routes to portal
    if (token?.role === "INVESTOR") {
      if (path === "/" || path.startsWith("/assets") || path.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/portal", req.url));
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
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Admin routes require ADMIN role
    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/assets/:path*",
    "/admin/:path*",
    "/portal/:path*",
  ],
};
