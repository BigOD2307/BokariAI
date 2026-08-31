import configManager from '@/lib/config';
import { NextRequest } from 'next/server';
import { requireAdmin, HttpError } from '@/lib/auth/require';

export const POST = async (req: NextRequest) => {
  try {
    await requireAdmin(req);
  } catch (err) {
    return err instanceof HttpError
      ? err.toResponse()
      : Response.json({}, { status: 404 });
  }

  try {
    configManager.markSetupComplete();

    return Response.json(
      {
        message: 'Setup marked as complete.',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error marking setup as complete: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
