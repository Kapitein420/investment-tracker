import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // refresh every hour
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Normalise email before lookup. CSV imports often arrive with
        // mixed case ("Anna@Test.dils.com") and mobile keyboards
        // autocapitalise the first character — lookup is otherwise
        // exact-match and the legit user silently fails to log in.
        const email = credentials.email.trim().toLowerCase();

        // Rate-limit failed credentials before the bcrypt cost. Vercel-
        // edge WAF blocks high-RPS bursts; this layer catches a paced
        // attacker that stays under the WAF threshold. 5 attempts /
        // 15 min per (email, IP). Successful login below resets nothing
        // — the window expires naturally.
        const ip = await getClientIp();
        const [emailLimit, ipLimit] = await Promise.all([
          checkRateLimit(`auth:email:${email}`, 5, 15 * 60),
          checkRateLimit(`auth:ip:${ip}`, 30, 15 * 60),
        ]);
        if (!emailLimit.allowed || !ipLimit.allowed) {
          console.warn(
            `[auth] rate-limited email=${email} ip=${ip} ` +
              `emailRemaining=${emailLimit.remaining} ipRemaining=${ipLimit.remaining}`
          );
          return null;
        }

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        // Mark pending invites as accepted on first login (for INVESTOR users)
        if (user.role === "INVESTOR") {
          await prisma.investorInvite.updateMany({
            where: { email: user.email, acceptedAt: null },
            data: { acceptedAt: new Date() },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          mustChangePassword: user.passwordChangedAt === null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.mustChangePassword = (user as any).mustChangePassword === true;
      }
      // Refresh role/companyId/mustChangePassword from DB on token refresh
      if (token.id && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            companyId: true,
            isActive: true,
            passwordChangedAt: true,
          },
        });
        if (dbUser && dbUser.isActive) {
          token.role = dbUser.role;
          token.companyId = dbUser.companyId;
          token.mustChangePassword = dbUser.passwordChangedAt === null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).mustChangePassword = token.mustChangePassword === true;
      }
      return session;
    },
  },
};
