import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      companyId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    companyId: string | null;
    mustChangePassword?: boolean;
    // Epoch ms of the last credential rotation, stamped at sign-in. Used to
    // invalidate sessions issued before a password change.
    pwChangedAt?: number;
    // Set by the jwt callback when the account is deactivated or its
    // password rotated since this token was minted.
    invalidated?: boolean;
  }
}
