import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function auth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
}

export async function GET(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    let query = supabase.from('account_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transactions: data });
}

export async function POST(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { account_id, type, amount, description, reference, date } = await request.json();
    if (!account_id || !type || !amount || !description) {
        return NextResponse.json({ error: 'account_id, type, amount, and description are required' }, { status: 400 });
    }

    // Get current balance
    const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', account_id)
        .single();
    if (accErr || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const current = Number(account.current_balance);
    const amt = Number(amount);
    const balance_after = type === 'credit' ? current + amt : current - amt;

    // Insert transaction
    const { data: tx, error: txErr } = await supabase
        .from('account_transactions')
        .insert({ account_id, type, amount: amt, description, reference, date: date || new Date().toISOString().split('T')[0], balance_after })
        .select()
        .single();
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    // Update account balance
    const { error: updErr } = await supabase
        .from('accounts')
        .update({ current_balance: balance_after, updated_at: new Date().toISOString() })
        .eq('id', account_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ transaction: tx, newBalance: balance_after }, { status: 201 });
}

export async function DELETE(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Get the transaction to reverse its effect
    const { data: tx } = await supabase.from('account_transactions').select('*').eq('id', id).single();
    if (tx) {
        const { data: account } = await supabase.from('accounts').select('current_balance').eq('id', tx.account_id).single();
        if (account) {
            const reversed = tx.type === 'credit'
                ? Number(account.current_balance) - Number(tx.amount)
                : Number(account.current_balance) + Number(tx.amount);
            await supabase.from('accounts').update({ current_balance: reversed, updated_at: new Date().toISOString() }).eq('id', tx.account_id);
        }
    }

    const { error } = await supabase.from('account_transactions').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
