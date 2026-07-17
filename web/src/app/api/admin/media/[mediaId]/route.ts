import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { mediaId } = await params;

  // soft-delete: keep the row (messages may reference it), deactivate for selection
  await prisma.mediaAsset.update({ where: { id: mediaId }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
