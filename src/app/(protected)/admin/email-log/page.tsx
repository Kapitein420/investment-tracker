import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentMailgunEvents } from "@/actions/mailgun-events";
import { EmailLogClient } from "@/components/admin/email-log-client";

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: { recipient?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  const recipient = searchParams.recipient?.trim() || undefined;
  const result = await getRecentMailgunEvents({ limit: 200, recipient });

  return <EmailLogClient initialResult={result} initialRecipient={recipient ?? ""} />;
}
