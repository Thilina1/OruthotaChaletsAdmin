import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
);

async function getUser(userId: string) {
    const { data } = await supabase
        .from('users')
        .select('id, role, restrict_admin_permissions, inventory_admin')
        .eq('id', userId)
        .single();
    return data;
}

async function syncInventoryCashApprovalNotifications() {
    const approvalPath = '/dashboard/inventory-cash-approvals';
    const [usersResult, pendingResult, additionalResult] = await Promise.all([
        supabase.from('users').select('id, role, restrict_admin_permissions, inventory_admin, permissions'),
        supabase.from('inventory_cash_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('inventory_cash_requests').select('id', { count: 'exact', head: true }).eq('additional_status', 'PENDING'),
    ]);

    if (usersResult.error || pendingResult.error || additionalResult.error) {
        console.error(
            'Failed to synchronize inventory cash approval notifications:',
            usersResult.error?.message || pendingResult.error?.message || additionalResult.error?.message
        );
        return;
    }

    const pendingCount = (pendingResult.count ?? 0) + (additionalResult.count ?? 0);
    const recipients = (usersResult.data ?? []).filter(user => {
        const hasPermission = Array.isArray(user.permissions) && user.permissions.includes(approvalPath);
        const isAdmin = user.role === 'admin' && !user.restrict_admin_permissions;
        return hasPermission || isAdmin || user.inventory_admin === true;
    });

    const { error: clearError } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'inventory_cash_approval');

    if (clearError) {
        console.error('Failed to clear inventory cash approval notifications:', clearError.message);
        return;
    }

    if (recipients.length > 0 && pendingCount > 0) {
        const { error } = await supabase.from('notifications').insert(recipients.map(user => ({
            user_id: user.id,
            type: 'inventory_cash_approval',
            title: 'Inventory Cash and Credit Approvals',
            message: `${pendingCount} cash or credit request${pendingCount === 1 ? '' : 's'} awaiting your approval.`,
            href: approvalPath,
        })));
        if (error) console.error('Failed to create inventory cash approval notifications:', error.message);
    }
}

async function syncInventoryCashIssuanceNotifications() {
    const issuancePath = '/dashboard/accounting/inventory-cash';
    const [usersResult, approvedResult, additionalResult] = await Promise.all([
        supabase.from('users').select('id, role, restrict_admin_permissions, permissions'),
        supabase
            .from('inventory_cash_requests')
            .select('id, purchase_order:purchase_orders(payment_type)', { count: 'exact' })
            .eq('status', 'APPROVED'),
        supabase
            .from('inventory_cash_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'ISSUED')
            .eq('additional_status', 'APPROVED'),
    ]);

    if (usersResult.error || approvedResult.error || additionalResult.error) {
        console.error(
            'Failed to synchronize inventory cash issuance notifications:',
            usersResult.error?.message || approvedResult.error?.message || additionalResult.error?.message
        );
        return;
    }

    const approvedCashCount = (approvedResult.data ?? []).filter((request: any) =>
        request.purchase_order?.payment_type !== 'credit'
    ).length;
    const pendingCount = approvedCashCount + (additionalResult.count ?? 0);
    const recipients = (usersResult.data ?? []).filter(user => {
        const hasPermission = Array.isArray(user.permissions) && user.permissions.includes(issuancePath);
        const isAdmin = user.role === 'admin' && !user.restrict_admin_permissions;
        return hasPermission || isAdmin || user.role === 'payment';
    });

    const { error: clearError } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'inventory_cash_issuance');

    if (clearError) {
        console.error('Failed to clear inventory cash issuance notifications:', clearError.message);
        return;
    }

    if (recipients.length > 0 && pendingCount > 0) {
        const { error } = await supabase.from('notifications').insert(recipients.map(user => ({
            user_id: user.id,
            type: 'inventory_cash_issuance',
            title: 'Inventory Cash Awaiting Issuance',
            message: `${pendingCount} cash request${pendingCount === 1 ? '' : 's'} ready to issue.`,
            href: issuancePath,
        })));
        if (error) console.error('Failed to create inventory cash issuance notifications:', error.message);
    }
}

async function createCashRequestStatusNotification(existing: any, type: string, title: string, message: string) {
    if (!existing?.requested_by) return;
    const { error } = await supabase.from('notifications').insert({
        user_id: existing.requested_by,
        type,
        title,
        message,
        href: '/dashboard/inventory-cash-requests',
    });
    if (error) console.error('Failed to create inventory cash request notification:', error.message);
}

async function creditReturnedInventoryCash(requestNumber: string, purpose: string, returnedAmount: number, accountId: string) {
    if (!Number.isFinite(returnedAmount) || returnedAmount <= 0) return;

    const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', accountId)
        .eq('is_active', true)
        .single();
    if (accountError || !account) throw accountError || new Error('Return destination account not found');

    const newBalance = Number(account.current_balance || 0) + returnedAmount;
    const { data: transaction, error: transactionError } = await supabase
        .from('account_transactions')
        .insert({
            account_id: accountId,
            type: 'credit',
            amount: returnedAmount,
            description: `Inventory cash return - ${purpose}`,
            reference: requestNumber,
            date: new Date().toISOString().split('T')[0],
            balance_after: newBalance,
        })
        .select('id')
        .single();
    if (transactionError) throw transactionError;

    const { error: updateError } = await supabase
        .from('accounts')
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', accountId);
    if (updateError) throw updateError;

    return transaction.id as string;
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
                // Any authenticated user who can reach the inventory-cash page may issue.
                // Page-level access (route-config / section-groups) is the gate.
                if (existing.status !== 'APPROVED') {
                    return NextResponse.json({ error: 'Can only issue APPROVED requests' }, { status: 400 });
                }
                if (!body.account_id) return NextResponse.json({ error: 'Source account is required' }, { status: 400 });
                const issueAmount = body.issued_amount != null ? Number(body.issued_amount) : Number(existing.approved_amount);
                const { error: issueError } = await supabase.rpc('issue_inventory_cash', {
                    p_request_id: id, p_account_id: body.account_id, p_amount: issueAmount,
                    p_issued_by: payload.userId, p_is_additional: false,
                });
                if (issueError) return NextResponse.json({ error: issueError.message }, { status: 422 });
                await createCashRequestStatusNotification(
                    existing,
                    'inventory_cash_request',
                    'Inventory Cash Issued',
                    `${existing.request_number} has been issued for Rs ${issueAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
                );
                await syncInventoryCashApprovalNotifications();
                await syncInventoryCashIssuanceNotifications();
                return NextResponse.json({ success: true });
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
                if (!body.account_id) return NextResponse.json({ error: 'Source account is required' }, { status: 400 });
                const { error: issueError } = await supabase.rpc('issue_inventory_cash', {
                    p_request_id: id, p_account_id: body.account_id, p_amount: addIssued,
                    p_issued_by: payload.userId, p_is_additional: true,
                });
                if (issueError) return NextResponse.json({ error: issueError.message }, { status: 422 });
                await createCashRequestStatusNotification(
                    existing,
                    'inventory_cash_request',
                    'Additional Cash Issued',
                    `Additional cash for ${existing.request_number} has been issued for Rs ${Number(addIssued).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
                );
                await syncInventoryCashApprovalNotifications();
                await syncInventoryCashIssuanceNotifications();
                return NextResponse.json({ success: true });
            }

            case 'move_return': {
                if (!isAdmin && !isPayment) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (existing.status !== 'SETTLED') {
                    return NextResponse.json({ error: 'Can only move returns for SETTLED requests' }, { status: 400 });
                }
                if (!body.account_id) return NextResponse.json({ error: 'Destination account is required' }, { status: 400 });
                const returnedAmount = Number(existing.returned_amount || 0);
                if (!Number.isFinite(returnedAmount) || returnedAmount <= 0) {
                    return NextResponse.json({ error: 'No returned amount to move' }, { status: 400 });
                }
                if (existing.returned_account_transaction_id) {
                    return NextResponse.json({ error: 'Returned amount has already been moved to an account' }, { status: 400 });
                }
                const transactionId = await creditReturnedInventoryCash(existing.request_number, existing.purpose, returnedAmount, body.account_id);
                const { data, error } = await supabase
                    .from('inventory_cash_requests')
                    .update({
                        returned_account_id: body.account_id,
                        returned_account_transaction_id: transactionId,
                        returned_moved_by: payload.userId,
                        returned_moved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                return NextResponse.json({ request: data });
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
        if (action === 'approve') {
            await createCashRequestStatusNotification(
                existing,
                'inventory_cash_request',
                'Cash Request Approved',
                `${existing.request_number} has been approved for Rs ${Number(data.approved_amount ?? existing.requested_amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            );
        } else if (action === 'reject') {
            await createCashRequestStatusNotification(
                existing,
                'inventory_cash_request',
                'Cash Request Rejected',
                `${existing.request_number} has been rejected.${data.rejection_reason ? ` Reason: ${data.rejection_reason}` : ''}`
            );
        } else if (action === 'settle') {
            if (data.additional_status === 'PENDING') {
                await syncInventoryCashApprovalNotifications();
            }
        } else if (action === 'approve_additional') {
            await createCashRequestStatusNotification(
                existing,
                'inventory_cash_request',
                'Additional Cash Approved',
                `Additional cash for ${existing.request_number} has been approved for Rs ${Number(data.additional_approved_amount ?? existing.additional_requested_amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            );
        } else if (action === 'reject_additional') {
            await createCashRequestStatusNotification(
                existing,
                'inventory_cash_request',
                'Additional Cash Rejected',
                `Additional cash for ${existing.request_number} has been rejected.`
            );
        }
        await syncInventoryCashApprovalNotifications();
        await syncInventoryCashIssuanceNotifications();
        return NextResponse.json({ request: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
