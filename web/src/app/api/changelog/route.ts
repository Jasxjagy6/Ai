import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public "What's New" feed. */
export async function GET() {
  const entries = await prisma.changelog.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, tag: true, createdAt: true },
  });
  return NextResponse.json({ entries });
}
