import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_PREFIXES = [
  "/workspace",
  "/buy",
  "/validator-admin",
  "/api/validator",
  "/api/validator-admin",
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const standalone = process.env.VALIDATOR_STANDALONE === "true";
  if (!standalone) {
    if (
      pathname === "/workspace" ||
      pathname === "/buy" ||
      pathname === "/validator-admin"
    ) {
      const base =
        process.env.VALIDATOR_PUBLIC_URL?.replace(/\/$/, "") ||
        "http://localhost:3100";
      return NextResponse.redirect(new URL(`${base}${pathname}${request.nextUrl.search}`));
    }
    if (
      pathname.startsWith("/api/validator/") ||
      pathname.startsWith("/api/validator-admin/")
    )
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.next();
  }
  if (
    pathname === "/" ||
    ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  )
    return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
