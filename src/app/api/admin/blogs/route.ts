import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Ideally check for admin/privileged role here
        // if (payload.role !== 'admin') ...

        const body = await request.json();

        // Validate basic fields
        if (!body.title || !body.preview_header) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('blogs')
            .insert(body)
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            return NextResponse.json({ error: error.message, details: error }, { status: 500 });
        }

        return NextResponse.json({ blog: data }, { status: 201 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // Handle featured logic if featured status is changing
        if (updates.featured !== undefined) {
            const { data: currentBlog } = await supabase.from('blogs').select('featured, featured_position').eq('id', id).single();

            if (currentBlog) {
                const wasFeatured = currentBlog.featured;
                const isNowFeatured = updates.featured;

                if (!wasFeatured && isNowFeatured) {
                    // Becoming featured: add to end
                    const { count } = await supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('featured', true);
                    updates.featured_position = (count || 0) + 1;
                } else if (wasFeatured && !isNowFeatured) {
                    // Removing features: nullify pos and shift others
                    updates.featured_position = null;

                    // Shift others down
                    const currentPos = currentBlog.featured_position || 0;
                    const { data: others } = await supabase.from('blogs').select('id, featured_position').eq('featured', true).gt('featured_position', currentPos);

                    if (others && others.length > 0) {
                        // We have to do this sequentially or batch rpc ideally, but loop is okay for small number (featured usually small)
                        for (const other of others) {
                            await supabase.from('blogs').update({ featured_position: (other.featured_position || 1) - 1 }).eq('id', other.id);
                        }
                    }
                }
            }
        }

        const { data, error } = await supabase
            .from('blogs')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ blog: data }, { status: 200 });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // Check if featured to reorder others
        const { data: blog } = await supabase.from('blogs').select('featured, featured_position').eq('id', id).single();

        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (error) throw error;

        if (blog?.featured) {
            // Reorder remaining
            const { data: others } = await supabase.from('blogs').select('id, featured_position').eq('featured', true).gt('featured_position', blog.featured_position || 0);
            if (others) {
                for (const other of others) {
                    await supabase.from('blogs').update({ featured_position: (other.featured_position || 1) - 1 }).eq('id', other.id);
                }
            }
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
