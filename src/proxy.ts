import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  COUNTRY_COOKIE_NAME,
  COUNTRY_COOKIE_MAX_AGE,
  parseCfIpCountry,
} from '@/lib/auth/country';

const COUNTRY_HEADER = 'cf-ipcountry';
const COOKIE_PATH = '/';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  const existing = request.cookies.get(COUNTRY_COOKIE_NAME)?.value;
  if (existing) {
    return response;
  }

  const headerValue = request.headers.get(COUNTRY_HEADER);
  if (!headerValue) {
    return response;
  }

  const country = parseCfIpCountry(headerValue);
  response.cookies.set({
    name: COUNTRY_COOKIE_NAME,
    value: country,
    path: COOKIE_PATH,
    maxAge: COUNTRY_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });

  return response;
}
