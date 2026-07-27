import { NextResponse } from "next/server";
import { importList } from "@/lib/list-service";
import { LIST_TYPES, ListError, parseListContent } from "@/lib/lists";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";
import { runChargedValidatorTask } from "@/lib/validator-credits";

const MAX_FILE_BYTES = Math.max(
  1024,
  Number(process.env.LIST_MAX_FILE_BYTES || 100 * 1024 * 1024),
);

export async function POST(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const form = await request.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "")
      .trim()
      .slice(0, 255);
    const requestedType = String(form.get("type") || "users");
    const type =
      LIST_TYPES.has(requestedType) && requestedType !== "merged"
        ? requestedType
        : "users";
    if (!name)
      throw new ListError("List name is required", 400, "MISSING_LIST_NAME");
    if (!(file instanceof File))
      throw new ListError(
        "Choose a CSV, JSON, or TXT file",
        400,
        "MISSING_FILE",
      );
    if (file.size > MAX_FILE_BYTES) {
      throw new ListError(
        `Files may be at most ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`,
        400,
        "FILE_TOO_LARGE",
      );
    }
    const parsed = parseListContent(
      await file.text(),
      file.name,
      file.type,
      type,
    );
    const data = await runChargedValidatorTask(
      {
        accountId: account.id,
        accessKeyId: account.accessKeyId,
        taskCode: "list_import",
        items: parsed.items.length,
        description: `Import ${parsed.items.length.toLocaleString()} list rows`,
      },
      () =>
        importList(
          account.id,
          name,
          type,
          `import_${file.name.split(".").pop()?.toLowerCase() || "file"}`,
          parsed,
        ),
    );
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return validatorError(error);
  }
}
