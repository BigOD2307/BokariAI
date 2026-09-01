import { clearAccessTokenCookie } from '@/lib/auth/tokens';

// A real logout now (it used to be a no-op stub — Supabase Auth's signOut()
// was entirely client-side, there was nothing server-side to clear). Now
// that the access token IS a cookie this server issued, clearing it here is
// the only way to actually end the session for a client that doesn't run JS
// (or whose JS already navigated away).
export const POST = async () => {
  return Response.json(
    { success: true },
    { status: 200, headers: { 'Set-Cookie': clearAccessTokenCookie() } },
  );
};
