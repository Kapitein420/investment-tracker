const MAILGUN_API_BASE =
  process.env.MAILGUN_API_BASE || "https://api.eu.mailgun.net/v3";
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM =
  process.env.MAILGUN_FROM ||
  "Investment Tracker <investments.netherlands@mg.dils.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    // Silent skip in dev; loud failure in production. Previously this branch
    // returned silently in every environment, which let an admin think they'd
    // sent an invite when no email actually went out.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email service not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing in env)."
      );
    }
    console.log(
      `[Email skipped - Mailgun not configured] To: ${to}, Subject: ${subject}`,
    );
    return;
  }

  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
  const body = new URLSearchParams({
    from: MAILGUN_FROM,
    to,
    subject,
    html,
  });

  const res = await fetch(
    `${MAILGUN_API_BASE}/${MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Mailgun email failed (${res.status}): ${errorText}`);
  }
}
