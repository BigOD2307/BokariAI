export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMP diagnostic sink for the stuck-on-"Chargement…" bug. Devices that fail
 * to become ready POST their state here; we read it back with `docker logs`.
 * No auth on purpose (guests are the affected population) — payload is
 * size-capped and only ever logged. Remove with the client beacon once fixed.
 */
export const POST = async (req: Request) => {
  try {
    const text = (await req.text()).slice(0, 4000);
    console.warn('[BkDiag]', text);
  } catch {
    console.warn('[BkDiag] unreadable body');
  }
  return Response.json({ ok: true });
};
