'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Wallet } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type PettyCashRequest = {
    id: string;
    amount: number;
    reason: string;
    status: string;
    manager_status?: string | null;
    manager_remarks?: string | null;
    account_status?: string | null;
    account_remarks?: string | null;
    issued_at?: string | null;
    settled_at?: string | null;
    settlement_notes?: string | null;
    document_url?: string | null;
    amount_spent?: number | null;
    balance_status?: string | null;
    balance_amount?: number | null;
    request_date: string;
    created_at: string;
    manager?: { name: string } | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending_manager: { label: 'Awaiting Manager', className: 'bg-yellow-100 text-yellow-800' },
    pending_accounts: { label: 'Awaiting Accounts', className: 'bg-blue-100 text-blue-800' },
    approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
    issued: { label: 'Issued', className: 'bg-purple-100 text-purple-800' },
    settled: { label: 'Settled', className: 'bg-gray-100 text-gray-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
};

export default function MyPettyCashPage() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<PettyCashRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const [newOpen, setNewOpen] = useState(false);
    const [newForm, setNewForm] = useState({ amount: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);

    const [settleReq, setSettleReq] = useState<PettyCashRequest | null>(null);
    const [settleForm, setSettleForm] = useState({ amount_spent: '', document_url: '', settlement_notes: '' });

    const fetch_requests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/petty-cash?view=mine');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setRequests(data.requests ?? []);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetch_requests(); }, [fetch_requests]);

    const handleNew = async () => {
        if (!newForm.amount || !newForm.reason) {
            toast({ variant: 'destructive', title: 'Required', description: 'Amount and reason are required.' });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/hrms/petty-cash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(newForm.amount), reason: newForm.reason }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Submitted', description: 'Your petty cash request has been submitted.' });
            setNewOpen(false);
            setNewForm({ amount: '', reason: '' });
            fetch_requests();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSettle = async () => {
        if (!settleReq) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/hrms/petty-cash', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: settleReq.id,
                    action: 'settle',
                    amount_spent: parseFloat(settleForm.amount_spent),
                    document_url: settleForm.document_url || null,
                    settlement_notes: settleForm.settlement_notes || null,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Settled', description: 'Document submitted successfully.' });
            setSettleReq(null);
            setSettleForm({ amount_spent: '', document_url: '', settlement_notes: '' });
            fetch_requests();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setSubmitting(false);
        }
    };

    const counts = {
        pending: requests.filter(r => ['pending_manager', 'pending_accounts'].includes(r.status)).length,
        approved: requests.filter(r => r.status === 'approved').length,
        issued: requests.filter(r => r.status === 'issued').length,
        settled: requests.filter(r => r.status === 'settled').length,
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">My Petty Cash</h1>
                    <p className="text-muted-foreground">Request and track petty cash advances.</p>
                </div>
                <Button onClick={() => setNewOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Request
                </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Pending', value: counts.pending, className: 'text-yellow-700' },
                    { label: 'Approved', value: counts.approved, className: 'text-green-700' },
                    { label: 'Issued', value: counts.issued, className: 'text-purple-700' },
                    { label: 'Settled', value: counts.settled, className: 'text-gray-600' },
                ].map(s => (
                    <Card key={s.label}>
                        <CardContent className="pt-4">
                            <div className={`text-2xl font-bold ${s.className}`}>{s.value}</div>
                            <div className="text-sm text-muted-foreground">{s.label}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> My Requests</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-10 text-muted-foreground">Loading...</p>
                    ) : requests.length === 0 ? (
                        <p className="text-center py-10 text-muted-foreground">No petty cash requests yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Issued (Rs)</TableHead>
                                    <TableHead>Spent (Rs)</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map(r => {
                                    const st = STATUS_LABELS[r.status] ?? { label: r.status, className: '' };
                                    const remarks = r.status === 'rejected'
                                        ? (r.manager_remarks || r.account_remarks || '—')
                                        : null;
                                    const diff = r.amount_spent != null ? Number(r.amount) - Number(r.amount_spent) : null;
                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell className="text-sm">{new Date(r.request_date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-medium">{Number(r.amount).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">
                                                {r.amount_spent != null ? Number(r.amount_spent).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell className="max-w-[160px] truncate text-sm">{r.reason}</TableCell>
                                            <TableCell>
                                                <Badge className={st.className}>{st.label}</Badge>
                                                {remarks && <div className="text-xs text-muted-foreground mt-0.5">{remarks}</div>}
                                            </TableCell>
                                            <TableCell>
                                                {diff != null && Math.abs(diff) >= 0.01 && (
                                                    diff > 0
                                                        ? <div className="space-y-0.5">
                                                            <Badge className={`text-xs ${r.balance_status === 'returned' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>
                                                                {r.balance_status === 'returned' ? 'Returned' : `Return Rs ${diff.toLocaleString()}`}
                                                            </Badge>
                                                            {r.balance_status === 'returned' && r.balance_amount != null && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Actual: Rs {Number(r.balance_amount).toLocaleString()}
                                                                    {Math.abs(Number(r.balance_amount) - diff) >= 0.01 && (
                                                                        <span className={Number(r.balance_amount) > diff ? ' text-green-700' : ' text-red-600'}>
                                                                            {' '}({Number(r.balance_amount) > diff ? '+' : ''}{(Number(r.balance_amount) - diff).toLocaleString()})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                          </div>
                                                        : <div className="space-y-0.5">
                                                            <Badge className={`text-xs ${r.balance_status === 'additional_issued' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                                                                {r.balance_status === 'additional_issued' ? 'Extra Issued' : `Claim Rs ${Math.abs(diff).toLocaleString()}`}
                                                            </Badge>
                                                            {r.balance_status === 'additional_issued' && r.balance_amount != null && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Issued: Rs {Number(r.balance_amount).toLocaleString()}
                                                                </div>
                                                            )}
                                                          </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {r.status === 'issued' && (
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        setSettleReq(r);
                                                        setSettleForm({ amount_spent: String(r.amount), document_url: '', settlement_notes: '' });
                                                    }}>
                                                        <Upload className="h-3 w-3 mr-1" /> Submit Document
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* New Request Dialog */}
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>New Petty Cash Request</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Amount (Rs)</Label>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="e.g. 5000"
                                value={newForm.amount}
                                onChange={e => setNewForm(p => ({ ...p, amount: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Reason</Label>
                            <Textarea
                                placeholder="Describe the purpose of this petty cash request..."
                                value={newForm.reason}
                                onChange={e => setNewForm(p => ({ ...p, reason: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
                        <Button onClick={handleNew} disabled={submitting}>Submit Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settle / Submit Document Dialog */}
            <Dialog open={!!settleReq} onOpenChange={open => { if (!open) setSettleReq(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Supporting Document</DialogTitle>
                    </DialogHeader>
                    {settleReq && (
                        <div className="space-y-4">
                            <div className="rounded-md border p-3 bg-muted/30 text-sm">
                                Issued: <strong>Rs {Number(settleReq.amount).toLocaleString()}</strong> — {settleReq.reason}
                            </div>
                            <div>
                                <Label>Actual Amount Spent (Rs)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={settleForm.amount_spent}
                                    onChange={e => setSettleForm(p => ({ ...p, amount_spent: e.target.value }))}
                                />
                            </div>
                            {settleForm.amount_spent && !isNaN(parseFloat(settleForm.amount_spent)) && (() => {
                                const spent = parseFloat(settleForm.amount_spent);
                                const diff = Number(settleReq.amount) - spent;
                                if (Math.abs(diff) < 0.01) return null;
                                return diff > 0
                                    ? <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                        You have Rs {diff.toLocaleString()} remaining — you will need to return this to accounts.
                                      </p>
                                    : <p className="text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                                        You spent Rs {Math.abs(diff).toLocaleString()} more than issued — accounts will review and issue the difference.
                                      </p>;
                            })()}
                            <div>
                                <Label>Document URL (optional)</Label>
                                <Input
                                    placeholder="Paste link to scanned receipt / document"
                                    value={settleForm.document_url}
                                    onChange={e => setSettleForm(p => ({ ...p, document_url: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Leave blank if submitting a hand-written document directly to accounts.</p>
                            </div>
                            <div>
                                <Label>Notes to Accounts</Label>
                                <Textarea
                                    placeholder="Any notes about this settlement..."
                                    value={settleForm.settlement_notes}
                                    onChange={e => setSettleForm(p => ({ ...p, settlement_notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSettleReq(null)}>Cancel</Button>
                        <Button onClick={handleSettle} disabled={submitting || !settleForm.amount_spent}>Confirm Settlement</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
