import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email skipped - no API key] To: ${to}, Subject: ${subject}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: "Investment Tracker <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  if (error) throw new Error(`Email failed: ${error.message}`);
}
