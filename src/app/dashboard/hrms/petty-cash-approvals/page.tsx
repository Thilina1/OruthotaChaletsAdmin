'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type PettyCashRequest = {
    id: string;
    amount: number;
    reason: string;
    status: string;
    request_date: string;
    created_at: string;
    employee?: { name: string; job_title?: string; department?: string } | null;
};

export default function PettyCashApprovalsPage() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<PettyCashRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionReq, setActionReq] = useState<{ req: PettyCashRequest; type: 'approve' | 'reject' } | null>(null);
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/petty-cash?view=manager');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setRequests(data.requests ?? []);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleAction = async () => {
        if (!actionReq) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/hrms/petty-cash', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: actionReq.req.id,
                    action: actionReq.type === 'approve' ? 'manager_approve' : 'manager_reject',
                    remarks: remarks || null,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({
                title: actionReq.type === 'approve' ? 'Approved' : 'Rejected',
                description: `Request from ${actionReq.req.employee?.name} has been ${actionReq.type === 'approve' ? 'forwarded to accounts' : 'rejected'}.`,
            });
            setActionReq(null);
            setRemarks('');
            fetchRequests();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Petty Cash Approvals</h1>
                <p className="text-muted-foreground">Review and approve petty cash requests from your team.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Pending Requests
                        {requests.length > 0 && (
                            <Badge className="ml-2 bg-yellow-100 text-yellow-800">{requests.length}</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-10 text-muted-foreground">Loading...</p>
                    ) : requests.length === 0 ? (
                        <p className="text-center py-10 text-muted-foreground">No pending requests from your team.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Amount (Rs)</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell className="text-sm">{new Date(r.request_date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{r.employee?.name}</div>
                                            {r.employee?.job_title && (
                                                <div className="text-xs text-muted-foreground">{r.employee.job_title}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{Number(r.amount).toLocaleString()}</TableCell>
                                        <TableCell className="max-w-[250px]">{r.reason}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                onClick={() => { setActionReq({ req: r, type: 'approve' }); setRemarks(''); }}
                                            >
                                                <CheckCircle className="h-3 w-3 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => { setActionReq({ req: r, type: 'reject' }); setRemarks(''); }}
                                            >
                                                <XCircle className="h-3 w-3 mr-1" /> Reject
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!actionReq} onOpenChange={open => { if (!open) setActionReq(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionReq?.type === 'approve' ? 'Approve Request' : 'Reject Request'}
                        </DialogTitle>
                    </DialogHeader>
                    {actionReq && (
                        <div className="space-y-4">
                            <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                                <div><span className="font-medium">Employee:</span> {actionReq.req.employee?.name}</div>
                                <div><span className="font-medium">Amount:</span> Rs {Number(actionReq.req.amount).toLocaleString()}</div>
                                <div><span className="font-medium">Reason:</span> {actionReq.req.reason}</div>
                            </div>
                            <div>
                                <Label>Remarks {actionReq.type === 'reject' ? '(required)' : '(optional)'}</Label>
                                <Textarea
                                    placeholder={actionReq.type === 'reject' ? 'Reason for rejection...' : 'Optional comments...'}
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionReq(null)}>Cancel</Button>
                        <Button
                            onClick={handleAction}
                            disabled={submitting || (actionReq?.type === 'reject' && !remarks.trim())}
                            className={actionReq?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                            variant={actionReq?.type === 'reject' ? 'destructive' : 'default'}
                        >
                            {actionReq?.type === 'approve' ? 'Approve & Forward to Accounts' : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
