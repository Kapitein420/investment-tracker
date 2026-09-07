import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { SetPasswordClient } from "@/components/set-password-client";
import { findValidPasswordSetToken } from "@/lib/password-set-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Public, unauthenticated landing page for the one-time set-password links
 * that replaced emailed plaintext passwords (compliance gap G9). The token
 * in the URL is the only credential — same trust model as /sign/[token],
 * and the middleware matcher deliberately does not gate this path.
 */
export default async function SetPasswordPage(props: {
  params: Promise<{ token: string }>;
}) {
  const params = await props.params;

  // Same 30/min per-IP cap as /sign/[token]: tokens are 256-bit so
  // brute-force is infeasible, this just stops a probe hammering the lookup.
  const ip = await getClientIp();
  const rl = await checkRateLimit(`set-password-page:${ip}`, 30, 60);
  if (!rl.allowed) {
    return (
      <Notice title="Too many attempts">
        Please wait a minute and try again. If you reached this in error,
        contact the deal team.
      </Notice>
    );
  }

  const token = await findValidPasswordSetToken(params.token);

  // Unknown, expired, already used and deactivated-account all render the
  // same neutral message — telling them apart would confirm which links and
  // accounts exist.
  if (!token) {
    return (
      <Notice title="This link is no longer valid">
        Set-password links expire and can only be used once. Request a new one
        from the sign-in page, or contact the deal team.
      </Notice>
    );
  }

  return <SetPasswordClient token={params.token} userEmail={token.userEmail} />;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{children}</p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-dils-700 hover:text-dils-black"
        >
          Request a new link
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
