import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUser(userId: string) {
    const { data } = await supabase
        .from('users')
        .select('id, role, restrict_admin_permissions, inventory_admin')
        .eq('id', userId)
        .single();
    return data;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { id } = await params;
        const body = await request.json();
        const { action } = body;

        const dbUser = await getUser(payload.userId);
        const isAdmin = dbUser?.role === 'admin' && !dbUser?.restrict_admin_permissions;
        const isInventoryAdmin = dbUser?.inventory_admin === true;
        const isPayment = dbUser?.role === 'payment';

        const { data: existing, error: fetchError } = await supabase
            .from('inventory_cash_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        let updateData: any = { updated_at: new Date().toISOString() };

        switch (action) {
            case 'approve':
                if (!isAdmin && !isInventoryAdmin) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.status !== 'PENDING') {
                    return NextResponse.json({ error: 'Can only approve PENDING requests' }, { status: 400 });
                }
                updateData = {
                    ...updateData,
                    status: 'APPROVED',
                    approved_amount: body.approved_amount != null ? Number(body.approved_amount) : existing.requested_amount,
                    approved_by: payload.userId,
                    approved_at: new Date().toISOString(),
                };
                break;

            case 'reject':
                if (!isAdmin && !isInventoryAdmin) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.status !== 'PENDING') {
                    return NextResponse.json({ error: 'Can only reject PENDING requests' }, { status: 400 });
                }
                updateData = {
                    ...updateData,
                    status: 'REJECTED',
                    rejection_reason: body.rejection_reason || null,
                    approved_by: payload.userId,
                    approved_at: new Date().toISOString(),
                };
                break;

            case 'issue': {
                if (!isAdmin && !isPayment) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.status !== 'APPROVED') {
                    return NextResponse.json({ error: 'Can only issue APPROVED requests' }, { status: 400 });
                }
                updateData = {
                    ...updateData,
                    status: 'ISSUED',
                    issued_amount: body.issued_amount != null ? Number(body.issued_amount) : existing.approved_amount,
                    issued_by: payload.userId,
                    issued_at: new Date().toISOString(),
                };
                break;
            }

            case 'settle': {
                if (existing.requested_by !== payload.userId && !isAdmin && !isInventoryAdmin) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.status !== 'ISSUED') {
                    return NextResponse.json({ error: 'Can only settle ISSUED requests' }, { status: 400 });
                }
                if (existing.additional_status === 'PENDING' || existing.additional_status === 'APPROVED') {
                    return NextResponse.json({ error: 'Pending additional request must be resolved first' }, { status: 400 });
                }
                const spent = Number(body.spent_amount);
                if (isNaN(spent) || spent < 0) {
                    return NextResponse.json({ error: 'Invalid spent amount' }, { status: 400 });
                }
                const totalIssued = (existing.issued_amount || 0) + (existing.additional_issued_amount || 0);

                if (spent <= totalIssued) {
                    updateData = {
                        ...updateData,
                        status: 'SETTLED',
                        spent_amount: spent,
                        returned_amount: totalIssued - spent,
                        settled_at: new Date().toISOString(),
                    };
                } else {
                    // Overspend — raise additional request automatically
                    if (!body.additional_reason?.trim()) {
                        return NextResponse.json({ error: 'Reason required for overspend' }, { status: 400 });
                    }
                    updateData = {
                        ...updateData,
                        spent_amount: spent,
                        additional_requested_amount: spent - totalIssued,
                        additional_reason: body.additional_reason.trim(),
                        additional_status: 'PENDING',
                    };
                }
                break;
            }

            case 'approve_additional':
                if (!isAdmin && !isInventoryAdmin) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.additional_status !== 'PENDING') {
                    return NextResponse.json({ error: 'No pending additional request' }, { status: 400 });
                }
                updateData = {
                    ...updateData,
                    additional_status: 'APPROVED',
                    additional_approved_amount: body.additional_approved_amount != null
                        ? Number(body.additional_approved_amount)
                        : existing.additional_requested_amount,
                };
                break;

            case 'reject_additional':
                if (!isAdmin && !isInventoryAdmin) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.additional_status !== 'PENDING') {
                    return NextResponse.json({ error: 'No pending additional request' }, { status: 400 });
                }
                updateData = {
                    ...updateData,
                    additional_status: 'REJECTED',
                    additional_rejection_reason: body.rejection_reason || null,
                };
                break;

            case 'issue_additional': {
                if (!isAdmin && !isPayment) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.additional_status !== 'APPROVED') {
                    return NextResponse.json({ error: 'Additional request not yet approved' }, { status: 400 });
                }
                const addIssued = body.additional_issued_amount != null
                    ? Number(body.additional_issued_amount)
                    : existing.additional_approved_amount;
                // Keep status ISSUED — employee must still submit a final settlement
                // confirming their total spend and returning any unused additional cash
                updateData = {
                    ...updateData,
                    additional_issued_amount: addIssued,
                    additional_status: 'ISSUED',
                };
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('inventory_cash_requests')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ request: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
