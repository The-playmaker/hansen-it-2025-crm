import { NextResponse } from 'next/server';

export function middleware(req) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/dashboard')) return NextResponse.next();

  const basicAuth = req.headers.get('authorization');
  const USER = process.env.BASIC_AUTH_USER || 'hansen';
  const PASS = process.env.BASIC_AUTH_PASS || 'dev1234';

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = Buffer.from(authValue, 'base64').toString().split(':');
    if (user === USER && pwd === PASS) return NextResponse.next();
  }
  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Hansen IT CRM"' },
  });
}

export const config = { matcher: ['/dashboard/:path*'] };
