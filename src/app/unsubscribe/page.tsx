import Image from "next/image";
import { Button } from "@/components/ui/button";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { confirmUnsubscribe } from "@/actions/unsubscribe-actions";

/**
 * Public, unauthenticated unsubscribe landing page — the target of the
 * link in every commercial email footer and the List-Unsubscribe header
 * (Telecommunicatiewet 11.7 lid 4). No auth: the token in the URL is the
 * only credential, same trust model as /sign/[token].
 */
export default async function UnsubscribePage(props: {
  searchParams: Promise<{ e?: string; t?: string; done?: string }>;
}) {
  const searchParams = await props.searchParams;
  const email = searchParams.e ?? "";
  const token = searchParams.t ?? "";
  const valid = Boolean(email && token && verifyUnsubscribeToken(email, token));

  return (
    <div className="flex min-h-screen items-center justify-center bg-dils-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-md border border-dils-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <Image
          src="/dils-logo.png"
          alt="DILS"
          width={140}
          height={44}
          priority
          className="mx-auto h-10 w-auto object-contain sm:h-11"
        />

        {!valid ? (
          <p className="text-sm text-muted-foreground">
            This link is invalid or expired.
          </p>
        ) : searchParams.done ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-dils-black">You&rsquo;re unsubscribed.</p>
            <p className="text-xs text-muted-foreground">
              Transactional messages about documents you sign or your account may still be sent.
            </p>
          </div>
        ) : (
          <form action={confirmUnsubscribe} className="space-y-4">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            <p className="text-sm text-dils-black">
              Unsubscribe <strong>{email}</strong> from DILS Investor Portal deal emails?
            </p>
            <Button type="submit" className="w-full">
              Unsubscribe
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
