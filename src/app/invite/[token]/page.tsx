import { redirect } from "next/navigation";

// Invites now auto-create accounts and send credentials via email.
// If someone visits an old invite link, just redirect to login.
export default function InvitePage() {
  redirect("/login");
}
