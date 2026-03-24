import { type NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth_token')?.value;
    const verifiedToken = token && await verifyToken(token) ? await verifyToken(token) : null;

    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!verifiedToken) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup') {
        if (verifiedToken) {
            return NextResponse.redirect(new URL('/dashboard/profile', request.url));
        }
    }

    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
