/**
 * Admin all-listing for the editorial review queue.
 *
 * Bokari has no role column in Supabase Auth; admin access is a small env
 * allow-list of emails. `BOKARI_ADMIN_EMAILS` is a comma-separated list; it
 * falls back to the project owner so the review queue works out of the box on
 * a fresh deploy. Keep this server-only (never import from a client component).
 */
const DEFAULT_ADMINS = 'dicken.media2@gmail.com';

function adminEmails(): string[] {
  return (process.env.BOKARI_ADMIN_EMAILS || DEFAULT_ADMINS)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Resolve the caller from a Supabase server client and assert they're an admin.
 * Returns the user's email on success, or null (caller should 401/403).
 */
export async function requireAdmin(req: Request): Promise<string | null> {
  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user.email ?? null;
}
