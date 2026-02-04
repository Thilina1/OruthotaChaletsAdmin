import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
        return NextResponse.json({ user: null }, { status: 200 }); // Invalid token
    }

    // Return user info from token
    // Ideally, validat against DB to sure user still exists/is active, but token is enough for stateless session
    const user = {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role
    };

    return NextResponse.json({ user }, { status: 200 });
}
