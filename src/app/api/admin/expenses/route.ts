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

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ expenses: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { description, amount, category, date, support_links = [] } = body;

        if (!description || !amount || !category || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let { data, error } = await supabase
            .from('expenses')
            .insert({ description, amount, category, date, support_links })
            .select()
            .single();

        // Older deployments may not have the optional support_links migration yet.
        if (error && error.message.toLowerCase().includes('support_links')) {
            ({ data, error } = await supabase
                .from('expenses')
                .insert({ description, amount, category, date })
                .select()
                .single());
        }

        if (error) throw error;

        return NextResponse.json({ expense: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { id, description, amount, category, date, support_links = [] } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data: requestItem, error: requestItemError } = await supabase
            .from('other_expense_cash_request_items')
            .select('request_id')
            .eq('expense_id', id)
            .maybeSingle();
        if (requestItemError) throw requestItemError;
        if (requestItem) {
            const { data: fundingRequest, error: fundingError } = await supabase
                .from('other_expense_cash_requests')
                .select('issued_amount')
                .eq('id', requestItem.request_id)
                .single();
            if (fundingError) throw fundingError;
            if (Number(fundingRequest?.issued_amount || 0) > 0) {
                return NextResponse.json({ error: 'This expense cannot be edited after Finance has issued funds.' }, { status: 409 });
            }
        }

        let { data, error } = await supabase
            .from('expenses')
            .update({ description, amount, category, date, support_links, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error && error.message.toLowerCase().includes('support_links')) {
            ({ data, error } = await supabase
                .from('expenses')
                .update({ description, amount, category, date, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single());
        }

        if (error) throw error;

        return NextResponse.json({ expense: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await verifyToken(token);
        if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { id, is_paid } = await request.json();
        if (!id || typeof is_paid !== 'boolean') {
            return NextResponse.json({ error: 'Expense and settlement status are required.' }, { status: 400 });
        }

        if (is_paid) {
            const [{ data: expense, error: expenseError }, { data: requestItem, error: itemError }] = await Promise.all([
                supabase.from('expenses').select('amount').eq('id', id).single(),
                supabase.from('other_expense_cash_request_items').select('request_id, amount').eq('expense_id', id).single(),
            ]);
            if (expenseError || !expense) return NextResponse.json({ error: expenseError?.message || 'Expense not found.' }, { status: 404 });
            if (itemError || !requestItem) return NextResponse.json({ error: 'Request and receive funds before settling this expense.' }, { status: 422 });
            const { data: funding, error: fundingError } = await supabase.from('other_expense_cash_requests')
                .select('issued_amount, requested_amount, status').eq('id', requestItem.request_id).single();
            if (fundingError || !funding) return NextResponse.json({ error: 'Funding request not found.' }, { status: 422 });
            if (Number(funding.issued_amount || 0) < Number(funding.requested_amount || 0)) {
                return NextResponse.json({ error: 'The full expense amount has not been issued yet.' }, { status: 422 });
            }
        }

        const { data, error } = await supabase.from('expenses').update({
            is_paid,
            paid_at: is_paid ? new Date().toISOString() : null,
            paid_by: is_paid ? user.userId : null,
            updated_at: new Date().toISOString(),
        }).eq('id', id).select().single();
        if (error) throw error;
        return NextResponse.json({ expense: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
