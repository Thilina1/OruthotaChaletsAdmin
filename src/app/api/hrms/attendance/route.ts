import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    try {
        let query = supabase
            .from('attendance')
            .select(`
        *,
        users!user_id (
          name,
          email,
          role
        )
      `)
            .order('date', { ascending: false })
            .order('clock_in', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }
        if (date) {
            query = query.eq('date', date);
        }

        const { data: attendance, error } = await query;

        if (error) throw error;

        return NextResponse.json({ attendance });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return NextResponse.json({ error: (error as Error).message || 'Error fetching attendance' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { user_id, action, latitude, longitude, date, clock_in, clock_out, status } = body;

        // Custom Auth Verification
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        const verifiedUser = token ? await verifyToken(token) : null;

        if (!verifiedUser || !verifiedUser.userId) {
            return NextResponse.json({ error: 'Unauthorized: Invalid or missing token.' }, { status: 401 });
        }

        let targetUserId = verifiedUser.userId;
        const isAdmin = verifiedUser.role === 'admin';

        if (action === 'admin_create') {
            if (!isAdmin) {
                return NextResponse.json({ error: 'Unauthorized: Admins only.' }, { status: 403 });
            }
            if (!user_id || !date) {
                return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
            }

            const { data: attendance, error } = await supabase
                .from('attendance')
                .insert([
                    {
                        user_id: user_id,
                        date: date,
                        clock_in: clock_in || null,
                        clock_out: clock_out || null,
                        status: status || 'present',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ attendance });
        }

        // Standard Clock In/Out Flow
        const today = new Date().toISOString().split('T')[0];

        if (action === 'clock_in') {
            const { data: existing } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', targetUserId)
                .eq('date', today)
                .single();

            if (existing) {
                return NextResponse.json({ error: 'Already clocked in today.' }, { status: 400 });
            }

            const { data: attendance, error } = await supabase
                .from('attendance')
                .insert([
                    {
                        user_id: targetUserId,
                        date: today,
                        clock_in: new Date().toISOString(),
                        status: 'present',
                        latitude,
                        longitude
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ attendance });

        } else if (action === 'clock_out') {
            const { data: existing } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', targetUserId)
                .eq('date', today)
                .single();

            if (!existing) {
                return NextResponse.json({ error: 'No clock-in record found for today.' }, { status: 400 });
            }

            if (existing.clock_out) {
                return NextResponse.json({ error: 'Already clocked out today.' }, { status: 400 });
            }

            const { data: attendance, error } = await supabase
                .from('attendance')
                .update({ clock_out: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ attendance });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error processing attendance:', error);
        return NextResponse.json({ error: (error as Error).message || 'Error processing attendance' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { id, clock_in, clock_out, status } = body;

        // Custom Auth Verification
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        const verifiedUser = token ? await verifyToken(token) : null;

        if (!verifiedUser || verifiedUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized: Admins only.' }, { status: 403 });
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing record ID.' }, { status: 400 });
        }

        const { data: attendance, error } = await supabase
            .from('attendance')
            .update({
                clock_in,
                clock_out,
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ attendance });
    } catch (error) {
        console.error('Error updating attendance:', error);
        return NextResponse.json({ error: (error as Error).message || 'Error updating attendance' }, { status: 500 });
    }
}
