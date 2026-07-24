import { exportList } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const format = new URL(request.url).searchParams.get("format")?.toLowerCase() || "csv";
    const exported = await exportList(account.id, (await params).id, format);
    return new Response(exported.content, {
      headers: {
        "Content-Type": exported.mimeType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return validatorError(error);
  }
}
