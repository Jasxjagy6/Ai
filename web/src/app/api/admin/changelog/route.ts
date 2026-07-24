import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Admin: list + create changelog entries. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const entries = await prisma.changelog.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ entries });
}

const schema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  tag: z.enum(["New", "Improved", "Fixed", "Security"]).optional().default("New"),
  published: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  const entry = await prisma.changelog.create({ data: parsed.data });
  return NextResponse.json({ entry });
}
