import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // First-login force-change-password gate. When passwordChangedAt is
    // NULL on the User row (admin reset, self-serve reset, or invite-set
    // password), the JWT carries mustChangePassword=true. Funnel every
    // authenticated route through /portal/change-password until the
    // password is rotated. The change-password page itself is exempt
    // (otherwise the redirect loops); /api/auth/* stays open so sign-out
    // works.
    if (token?.mustChangePassword) {
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
