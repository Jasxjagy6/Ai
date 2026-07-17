import { auth } from "@/lib/auth";
import { NavbarClient } from "@/components/navbar-client";

export async function Navbar() {
  const session = await auth();
  const user = session?.user as { name?: string | null; role?: string } | undefined;

  return (
    <NavbarClient
      loggedIn={!!session}
      isAdmin={user?.role === "ADMIN"}
      userName={user?.name ?? null}
    />
  );
}
