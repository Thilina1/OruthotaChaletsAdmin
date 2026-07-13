'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Banknote, Settings, History, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    document_url?: string | null;
    settlement_notes?: string | null;
    amount_spent?: number | null;
    balance_status?: string | null;
    balance_amount?: number | null;
    request_date: string;
    created_at: string;
    employee?: { name: string; job_title?: string; department?: string } | null;
    manager?: { name: string } | null;
    issued_by_user?: { name: string } | null;
    account_actioned_by_user?: { name: string } | null;
};

type PettyCashSettings = {
    id: string;
    daily_total_limit: number;
    small_request_threshold: number;
    small_pool_limit: number;
    large_pool_limit: number;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending_manager: { label: 'Awaiting Manager', className: 'bg-yellow-100 text-yellow-800' },
    pending_accounts: { label: 'Pending Approval', className: 'bg-blue-100 text-blue-800' },
    approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
    issued: { label: 'Issued', className: 'bg-purple-100 text-purple-800' },
    settled: { label: 'Settled', className: 'bg-gray-100 text-gray-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
};

function LimitBar({ label, used, limit, className }: { label: string; used: number; limit: number; className?: string }) {
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const avail = Math.max(0, limit - used);
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">
                    Used: <strong>Rs {used.toLocaleString()}</strong> / Limit: Rs {limit.toLocaleString()}
                    <span className={`ml-2 font-semibold ${avail === 0 ? 'text-red-600' : 'text-green-700'}`}>
                        (Available: Rs {avail.toLocaleString()})
                    </span>
                </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'} ${className ?? ''}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export default function PettyCashAccountsPage() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<PettyCashRequest[]>([]);
    const [settings, setSettings] = useState<PettyCashSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionReq, setActionReq] = useState<{ req: PettyCashRequest; type: 'approve' | 'reject' | 'issue' | 'confirm_return' | 'issue_additional' } | null>(null);
    const [remarks, setRemarks] = useState('');
    const [balanceAmountInput, setBalanceAmountInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        daily_total_limit: '',
        small_request_threshold: '',
        small_pool_limit: '',
        large_pool_limit: '',
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [reqRes, setRes] = await Promise.all([
                fetch('/api/hrms/petty-cash?view=accounts'),
                fetch('/api/hrms/petty-cash/settings'),
            ]);
            const [reqData, setData] = await Promise.all([reqRes.json(), setRes.json()]);
            if (reqData.error) throw new Error(reqData.error);
            setRequests(reqData.requests ?? []);
            if (!setData.error) {
                setSettings(setData.settings);
                const s = setData.settings as PettyCashSettings;
                setSettingsForm({
                    daily_total_limit: String(s.daily_total_limit),
                    small_request_threshold: String(s.small_request_threshold),
                    small_pool_limit: String(s.small_pool_limit),
                    large_pool_limit: String(s.large_pool_limit),
                });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const today = new Date().toISOString().split('T')[0];
    const todayIssued = requests.filter(r => ['issued', 'settled'].includes(r.status) && r.request_date === today);
    const threshold = settings?.small_request_threshold ?? 50000;
    const totalUsed = todayIssued.reduce((s, r) => s + Number(r.amount), 0);
    const smallUsed = todayIssued.filter(r => Number(r.amount) <= threshold).reduce((s, r) => s + Number(r.amount), 0);
    const largeUsed = todayIssued.filter(r => Number(r.amount) > threshold).reduce((s, r) => s + Number(r.amount), 0);

    const pendingApproval = requests.filter(r => r.status === 'pending_accounts');
    const readyToIssue = requests.filter(r => r.status === 'approved');
    const returnsNeeded = requests.filter(r => r.balance_status === 'return_pending');
    const additionalNeeded = requests.filter(r => r.balance_status === 'additional_pending');
    const balanceCount = returnsNeeded.length + additionalNeeded.length;

    const handleAction = async () => {
        if (!actionReq) return;
        setSubmitting(true);
        try {
            const actionMap: Record<string, string> = { approve: 'accounts_approve', reject: 'accounts_reject', issue: 'issue', confirm_return: 'confirm_return', issue_additional: 'issue_additional' };
            const res = await fetch('/api/hrms/petty-cash', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: actionReq.req.id,
                    action: actionMap[actionReq.type],
                    remarks: remarks || null,
                    balance_amount: balanceAmountInput ? parseFloat(balanceAmountInput) : null,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const messages: Record<string, string> = { approve: 'Approved and ready to issue.', reject: 'Request rejected.', issue: 'Cash issued to employee.', confirm_return: 'Balance return confirmed.', issue_additional: 'Additional cash issued.' };
            toast({ title: 'Done', description: messages[actionReq.type] });
            setActionReq(null);
            setRemarks('');
            fetchAll();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const body = {
                daily_total_limit: parseFloat(settingsForm.daily_total_limit),
                small_request_threshold: parseFloat(settingsForm.small_request_threshold),
                small_pool_limit: parseFloat(settingsForm.small_pool_limit),
                large_pool_limit: parseFloat(settingsForm.large_pool_limit),
            };
            const res = await fetch('/api/hrms/petty-cash/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Saved', description: 'Petty cash limits updated.' });
            setSettings(data.settings);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
        } finally {
            setSavingSettings(false);
        }
    };

    const RequestTable = ({ rows, showIssue }: { rows: PettyCashRequest[]; showIssue?: boolean }) => (
        rows.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No requests.</p>
        ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Amount (Rs)</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map(r => {
                        const st = STATUS_LABELS[r.status] ?? { label: r.status, className: '' };
                        const isSmall = Number(r.amount) <= threshold;
                        return (
                            <TableRow key={r.id}>
                                <TableCell className="text-sm">{new Date(r.request_date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{r.employee?.name}</div>
                                    {r.employee?.department && <div className="text-xs text-muted-foreground">{r.employee.department}</div>}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{Number(r.amount).toLocaleString()}</div>
                                    <Badge variant="outline" className="text-xs mt-0.5">{isSmall ? 'Small' : 'Large'}</Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px] text-sm">{r.reason}</TableCell>
                                <TableCell><Badge className={st.className}>{st.label}</Badge></TableCell>
                                <TableCell className="text-right space-x-2">
                                    {r.status === 'pending_accounts' && (
                                        <>
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                                onClick={() => { setActionReq({ req: r, type: 'approve' }); setRemarks(''); }}>
                                                <CheckCircle className="h-3 w-3 mr-1" /> Approve
                                            </Button>
                                            <Button size="sm" variant="destructive"
                                                onClick={() => { setActionReq({ req: r, type: 'reject' }); setRemarks(''); }}>
                                                <XCircle className="h-3 w-3 mr-1" /> Reject
                                            </Button>
                                        </>
                                    )}
                                    {showIssue && r.status === 'approved' && (
                                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white"
                                            onClick={() => { setActionReq({ req: r, type: 'issue' }); setRemarks(''); }}>
                                            <Banknote className="h-3 w-3 mr-1" /> Issue Cash
                                        </Button>
                                    )}
                                    {r.status === 'settled' && r.settlement_notes && (
                                        <span className="text-xs text-muted-foreground">{r.settlement_notes}</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        )
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Petty Cash — Accounts</h1>
                <p className="text-muted-foreground">Approve, issue, and manage petty cash limits.</p>
            </div>

            {/* Daily limit bars */}
            {settings && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Today&apos;s Pool Usage — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <LimitBar label="Daily Total" used={totalUsed} limit={settings.daily_total_limit} />
                        <LimitBar label={`Small Requests (≤ Rs ${settings.small_request_threshold.toLocaleString()})`} used={smallUsed} limit={settings.small_pool_limit} />
                        <LimitBar label={`Large Requests (> Rs ${settings.small_request_threshold.toLocaleString()})`} used={largeUsed} limit={settings.large_pool_limit} />
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending">
                        <Clock className="h-4 w-4 mr-1" />
                        Pending Approval {pendingApproval.length > 0 && `(${pendingApproval.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="issue">
                        <Banknote className="h-4 w-4 mr-1" />
                        Ready to Issue {readyToIssue.length > 0 && `(${readyToIssue.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="all">
                        <History className="h-4 w-4 mr-1" />
                        All Requests
                    </TabsTrigger>
                    <TabsTrigger value="balance">
                        <Banknote className="h-4 w-4 mr-1" />
                        Balance Actions {balanceCount > 0 && `(${balanceCount})`}
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                        <Settings className="h-4 w-4 mr-1" />
                        Limit Settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader><CardTitle>Pending Accounts Approval</CardTitle></CardHeader>
                        <CardContent>
                            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
                                : <RequestTable rows={pendingApproval} />}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="issue">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ready to Issue</CardTitle>
                            <CardDescription>These requests are approved. Issue cash after verifying available pool balance.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
                                : <RequestTable rows={readyToIssue} showIssue />}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="all">
                    <Card>
                        <CardHeader><CardTitle>All Requests</CardTitle></CardHeader>
                        <CardContent>
                            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
                                : <RequestTable rows={requests} showIssue />}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="balance">
                    <div className="space-y-4">
                        {/* Returns pending */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base text-amber-700">
                                    Cash to Collect from Employees
                                    {returnsNeeded.length > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800">{returnsNeeded.length}</Badge>}
                                </CardTitle>
                                <CardDescription>Employee spent less than issued — collect the balance.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {returnsNeeded.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No pending returns.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Issued (Rs)</TableHead>
                                                <TableHead>Spent (Rs)</TableHead>
                                                <TableHead>Expected Return (Rs)</TableHead>
                                                <TableHead>Actual Received (Rs)</TableHead>
                                                <TableHead>Notes</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {returnsNeeded.map(r => {
                                                const toReturn = Number(r.amount) - Number(r.amount_spent ?? 0);
                                                const variance = r.balance_amount != null ? Number(r.balance_amount) - toReturn : null;
                                                return (
                                                    <TableRow key={r.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{r.employee?.name}</div>
                                                            <div className="text-xs text-muted-foreground">{r.reason}</div>
                                                        </TableCell>
                                                        <TableCell>{Number(r.amount).toLocaleString()}</TableCell>
                                                        <TableCell>{Number(r.amount_spent ?? 0).toLocaleString()}</TableCell>
                                                        <TableCell className="font-semibold text-amber-700">{toReturn.toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            {r.balance_amount != null
                                                                ? <div>
                                                                    <span className="font-medium">{Number(r.balance_amount).toLocaleString()}</span>
                                                                    {variance != null && Math.abs(variance) >= 0.01 && (
                                                                        <span className={`ml-1 text-xs ${variance > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                                            ({variance > 0 ? '+' : ''}{variance.toLocaleString()})
                                                                        </span>
                                                                    )}
                                                                  </div>
                                                                : <span className="text-muted-foreground">—</span>}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{r.settlement_notes || '—'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                                                                onClick={() => { setActionReq({ req: r, type: 'confirm_return' }); setRemarks(''); setBalanceAmountInput(String(Number(r.amount) - Number(r.amount_spent ?? 0))); }}>
                                                                Confirm Received
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        {/* Additional claims pending */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base text-blue-700">
                                    Additional Cash to Issue
                                    {additionalNeeded.length > 0 && <Badge className="ml-2 bg-blue-100 text-blue-800">{additionalNeeded.length}</Badge>}
                                </CardTitle>
                                <CardDescription>Employee spent more than issued — issue the additional amount after review.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {additionalNeeded.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No additional claims pending.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Issued (Rs)</TableHead>
                                                <TableHead>Spent (Rs)</TableHead>
                                                <TableHead>Overspent (Rs)</TableHead>
                                                <TableHead>Actual Issued (Rs)</TableHead>
                                                <TableHead>Document</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {additionalNeeded.map(r => {
                                                const additional = Number(r.amount_spent ?? 0) - Number(r.amount);
                                                const variance = r.balance_amount != null ? Number(r.balance_amount) - additional : null;
                                                return (
                                                    <TableRow key={r.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{r.employee?.name}</div>
                                                            <div className="text-xs text-muted-foreground">{r.reason}</div>
                                                        </TableCell>
                                                        <TableCell>{Number(r.amount).toLocaleString()}</TableCell>
                                                        <TableCell>{Number(r.amount_spent ?? 0).toLocaleString()}</TableCell>
                                                        <TableCell className="font-semibold text-blue-700">{additional.toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            {r.balance_amount != null
                                                                ? <div>
                                                                    <span className="font-medium">{Number(r.balance_amount).toLocaleString()}</span>
                                                                    {variance != null && Math.abs(variance) >= 0.01 && (
                                                                        <span className={`ml-1 text-xs ${variance < 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                                                            ({variance > 0 ? '+' : ''}{variance.toLocaleString()})
                                                                        </span>
                                                                    )}
                                                                  </div>
                                                                : <span className="text-muted-foreground">—</span>}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {r.document_url
                                                                ? <a href={r.document_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">View Doc</a>
                                                                : <span className="text-muted-foreground">Hand document</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
                                                                onClick={() => { setActionReq({ req: r, type: 'issue_additional' }); setRemarks(''); setBalanceAmountInput(String(Number(r.amount_spent ?? 0) - Number(r.amount))); }}>
                                                                <Banknote className="h-3 w-3 mr-1" /> Issue Additional
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily Limit Configuration</CardTitle>
                            <CardDescription>
                                Set the daily petty cash pools. Small pool + Large pool must not exceed the Daily Total limit.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 max-w-lg">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Daily Total Limit (Rs)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={1000}
                                        value={settingsForm.daily_total_limit}
                                        onChange={e => setSettingsForm(p => ({ ...p, daily_total_limit: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Maximum total cash that can be issued in one day.</p>
                                </div>
                                <div>
                                    <Label>Small Request Threshold (Rs)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={1000}
                                        value={settingsForm.small_request_threshold}
                                        onChange={e => setSettingsForm(p => ({ ...p, small_request_threshold: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Requests at or below this are &quot;small&quot;.</p>
                                </div>
                                <div>
                                    <Label>Small Requests Pool (Rs)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={1000}
                                        value={settingsForm.small_pool_limit}
                                        onChange={e => setSettingsForm(p => ({ ...p, small_pool_limit: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Daily budget for small requests.</p>
                                </div>
                                <div>
                                    <Label>Large Requests Pool (Rs)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={1000}
                                        value={settingsForm.large_pool_limit}
                                        onChange={e => setSettingsForm(p => ({ ...p, large_pool_limit: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Daily budget for large requests.</p>
                                </div>
                            </div>
                            <Button onClick={handleSaveSettings} disabled={savingSettings}>
                                Save Limits
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Action Dialog */}
            <Dialog open={!!actionReq} onOpenChange={open => { if (!open) setActionReq(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionReq?.type === 'approve' && 'Approve Request'}
                            {actionReq?.type === 'reject' && 'Reject Request'}
                            {actionReq?.type === 'issue' && 'Issue Petty Cash'}
                            {actionReq?.type === 'confirm_return' && 'Confirm Cash Return'}
                            {actionReq?.type === 'issue_additional' && 'Issue Additional Cash'}
                        </DialogTitle>
                    </DialogHeader>
                    {actionReq && (
                        <div className="space-y-4">
                            <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                                <div><span className="font-medium">Employee:</span> {actionReq.req.employee?.name}</div>
                                <div><span className="font-medium">Amount:</span> Rs {Number(actionReq.req.amount).toLocaleString()}</div>
                                <div><span className="font-medium">Reason:</span> {actionReq.req.reason}</div>
                                {actionReq.req.manager && (
                                    <div><span className="font-medium">Manager Approved:</span> {actionReq.req.manager.name}</div>
                                )}
                            </div>
                            {actionReq.type !== 'issue' && (
                                <div>
                                    <Label>Remarks {actionReq.type === 'reject' ? '(required)' : '(optional)'}</Label>
                                    <Textarea
                                        placeholder={actionReq.type === 'reject' ? 'Reason for rejection...' : 'Optional notes...'}
                                        value={remarks}
                                        onChange={e => setRemarks(e.target.value)}
                                    />
                                </div>
                            )}
                            {actionReq.type === 'issue' && (
                                <p className="text-sm text-muted-foreground">
                                    Confirm issuing Rs {Number(actionReq.req.amount).toLocaleString()} to <strong>{actionReq.req.employee?.name}</strong>. This will be deducted from today&apos;s pool.
                                </p>
                            )}
                            {actionReq.type === 'confirm_return' && (() => {
                                const expected = Number(actionReq.req.amount) - Number(actionReq.req.amount_spent ?? 0);
                                const actual = parseFloat(balanceAmountInput) || 0;
                                const variance = actual - expected;
                                return (
                                    <div className="space-y-3">
                                        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                                            Expected return: <strong>Rs {expected.toLocaleString()}</strong>
                                        </div>
                                        <div>
                                            <Label>Actual Amount Received (Rs)</Label>
                                            <Input type="number" min={0} step={1} value={balanceAmountInput}
                                                onChange={e => setBalanceAmountInput(e.target.value)} />
                                        </div>
                                        {Math.abs(variance) >= 0.01 && (
                                            <p className={`text-xs px-3 py-2 rounded border ${variance > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                                {variance > 0
                                                    ? `Rs ${variance.toLocaleString()} extra received (overpayment)`
                                                    : `Rs ${Math.abs(variance).toLocaleString()} short — balance still outstanding`}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                            {actionReq.type === 'issue_additional' && (() => {
                                const expected = Number(actionReq.req.amount_spent ?? 0) - Number(actionReq.req.amount);
                                const actual = parseFloat(balanceAmountInput) || 0;
                                const variance = actual - expected;
                                return (
                                    <div className="space-y-3">
                                        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                                            Amount employee overspent: <strong>Rs {expected.toLocaleString()}</strong>
                                        </div>
                                        <div>
                                            <Label>Actual Amount to Issue (Rs)</Label>
                                            <Input type="number" min={0} step={1} value={balanceAmountInput}
                                                onChange={e => setBalanceAmountInput(e.target.value)} />
                                        </div>
                                        {Math.abs(variance) >= 0.01 && (
                                            <p className={`text-xs px-3 py-2 rounded border ${variance < 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                                {variance < 0
                                                    ? `Rs ${Math.abs(variance).toLocaleString()} less than overspent — partial reimbursement`
                                                    : `Rs ${variance.toLocaleString()} more than overspent — additional amount authorised`}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionReq(null)}>Cancel</Button>
                        <Button
                            onClick={handleAction}
                            disabled={submitting || (actionReq?.type === 'reject' && !remarks.trim())}
                            variant={actionReq?.type === 'reject' ? 'destructive' : 'default'}
                            className={
                                actionReq?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                                actionReq?.type === 'issue' ? 'bg-purple-600 hover:bg-purple-700' :
                                actionReq?.type === 'confirm_return' ? 'bg-amber-600 hover:bg-amber-700' :
                                actionReq?.type === 'issue_additional' ? 'bg-blue-600 hover:bg-blue-700' : ''
                            }
                        >
                            {actionReq?.type === 'approve' && 'Approve'}
                            {actionReq?.type === 'reject' && 'Reject'}
                            {actionReq?.type === 'issue' && 'Confirm Issue'}
                            {actionReq?.type === 'confirm_return' && 'Confirm Return Received'}
                            {actionReq?.type === 'issue_additional' && 'Issue Additional Cash'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
