// Shared between client and server auth code — kept in its own file with no
// server-only logic (secrets, env reads) so client components can safely
// import it without pulling in code that throws when SUPABASE_JWT_SECRET
// isn't inlined into the browser bundle (it never is — it's not NEXT_PUBLIC_).
export const ACCESS_TOKEN_COOKIE = 'sb-access-token';
