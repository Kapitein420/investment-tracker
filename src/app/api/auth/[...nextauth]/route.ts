import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// NextAuth's catch-all throws 500 with `Error: Callback for provider type
// credentials not supported` when a GET hits `/api/auth/callback/<provider>`
// — the provider only honours POST for the credential exchange. Return 405
// cleanly instead so the response body doesn't leak NextAuth-internal text
// and so route fingerprinters see the same boring 405 they get from
// `/api/mailgun/webhook`. (QC finding F-05.)
const CALLBACK_PATH = /^\/api\/auth\/callback\/[^/]+\/?$/;

export async function GET(request: Request, ctx: any) {
  const url = new URL(request.url);
  if (CALLBACK_PATH.test(url.pathname)) {
    return new Response(null, {
      status: 405,
      headers: { Allow: "POST" },
    });
  }
  return (handler as (req: Request, ctx: any) => Promise<Response>)(request, ctx);
}

export { handler as POST };
