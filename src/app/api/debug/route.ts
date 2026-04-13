import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { email: true, role: true, isActive: true, passwordHash: true },
    });

    // Test bcrypt against first user
    let bcryptTest = false;
    if (users.length > 0) {
      bcryptTest = await bcrypt.compare("password123", users[0].passwordHash);
    }

    return NextResponse.json({
      dbConnected: true,
      userCount,
      users: users.map((u) => ({
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        hashPrefix: u.passwordHash.substring(0, 20) + "...",
      })),
      bcryptTestForFirstUser: bcryptTest,
      databaseUrl: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/:[^@]+@/, ":***@")
        : "NOT SET",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        dbConnected: false,
        error: error.message,
        databaseUrl: process.env.DATABASE_URL
          ? process.env.DATABASE_URL.replace(/:[^@]+@/, ":***@")
          : "NOT SET",
      },
      { status: 500 }
    );
  }
}
