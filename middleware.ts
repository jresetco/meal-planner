import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/session-token'

const PUBLIC_PATH_PREFIXES: readonly string[] = [
  '/auth/login',
  '/auth/verify',
  '/api/auth/request-link',
  '/api/auth/verify',
  '/api/auth/logout',
  '/api/health',
]

const isPublicPath = (pathname: string): boolean => {
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const authSecret = process.env.APP_AUTH_SECRET
  if (!authSecret) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Auth not configured' },
        { status: 500 },
      )
    }
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const apiKey = request.headers.get('x-api-key')

  const hasValidSession =
    Boolean(cookie) && (await verifySessionToken(cookie)) !== null
  const hasValidApiKey = apiKey === authSecret
  const isAuthorized = hasValidSession || hasValidApiKey

  if (isAuthorized) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/auth/login', request.url)
  if (pathname && pathname !== '/') {
    loginUrl.searchParams.set('from', pathname)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
