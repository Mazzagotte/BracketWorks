import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/icons/android-chrome-192x192.png', request.url), 307);
}
