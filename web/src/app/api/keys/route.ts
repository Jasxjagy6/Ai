import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createApiKey } from "@/lib/api-keys";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, revoked: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
      usage: { where: { day: { gte: weekAgo } }, select: { day: true, requests: true } },
    },
  });
  return NextResponse.json({
    keys: keys.map((k) => ({
      ...k,
      requestsWeek: k.usage.reduce((s, u) => s + u.requests, 0),
      usage: undefined,
    })),
  });
}

const createSchema = z.object({ name: z.string().min(1).max(40) });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Give the key a name (1-40 chars)" }, { status: 400 });

  const result = await createApiKey(user.id, parsed.data.name);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result);
}
