import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // INVESTOR role: redirect away from admin routes to portal
    if (token?.role === "INVESTOR") {
      if (path === "/" || path.startsWith("/assets") || path.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/portal", req.url));
      }
    }

    // Non-investor trying to access portal
    if (path.startsWith("/portal") && token?.role !== "INVESTOR" && token?.role !== "ADMIN") {
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
