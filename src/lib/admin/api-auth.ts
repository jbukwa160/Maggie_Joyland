import "server-only";
import { getCurrentUser } from "@/lib/auth";

/** For admin route handlers: returns the admin user, or a 401 JSON response to send back. */
export async function adminOrUnauthorized() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { user: null, response: Response.json({ ok: false, error: "Нямате достъп. Влезте отново като администратор." }, { status: 401 }) } as const;
  }
  return { user, response: null } as const;
}
