'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Clock, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OtRequest {
  id: string;
  date: string;
  ot_hours: number;
  reason: string;
  status: 'pending' | 'manager_approved' | 'approved' | 'rejected';
  rejection_reason?: string;
  payroll_month: string;
  estimated_ot_pay: number;
  created_at: string;
  user?: { id: string; name: string; job_title?: string; department?: string } | null;
  approver?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  manager_approved: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  manager_approved: 'Manager Approved',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function OtApprovalsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<OtRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<OtRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const fetchRequests = () => {
    setLoading(true);
    fetch(`/api/hrms/ot-requests?month=${month}`)
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, [month]);

  const handleAction = async (id: string, status: 'approved' | 'rejected', rejection_reason?: string) => {
    setActing(id);
    try {
      const res = await fetch('/api/hrms/ot-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, rejection_reason }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: status === 'approved' ? 'OT Approved' : 'OT Rejected', description: `Request for ${data.request?.user?.name} has been ${status}.` });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status, rejection_reason: rejection_reason ?? '' } : r));
      setRejectDialog(false);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActing(null);
    }
  };

  // Awaiting admin action = manager_approved OR pending (if manager approval not required)
  const awaitingAdmin = requests.filter(r => r.status === 'manager_approved' || r.status === 'pending');
  const history = requests.filter(r => r.status === 'approved' || r.status === 'rejected');
  const approved = requests.filter(r => r.status === 'approved');
  const totalApprovedPay = approved.reduce((s, r) => s + (r.estimated_ot_pay ?? 0), 0);

  const RequestTable = ({ rows, showActions }: { rows: OtRequest[]; showActions: boolean }) => (
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground py-10 text-center">No requests.</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>OT Hours</TableHead>
            <TableHead>Est. OT Pay</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium text-sm">{r.user?.name ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{r.user?.job_title}{r.user?.department ? ` · ${r.user.department}` : ''}</div>
              </TableCell>
              <TableCell className="text-sm">{r.date}</TableCell>
              <TableCell className="font-bold text-blue-600">{r.ot_hours}h</TableCell>
              <TableCell className="font-semibold text-green-700">
                {r.estimated_ot_pay > 0 ? `LKR ${r.estimated_ot_pay.toLocaleString()}` : '—'}
              </TableCell>
              <TableCell className="text-sm">{r.payroll_month}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.reason || '—'}</TableCell>
              <TableCell>
                <div>
                  <Badge className={`text-xs ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</Badge>
                  {r.status === 'rejected' && r.rejection_reason && (
                    <p className="text-xs text-red-600 mt-0.5 max-w-32 truncate">{r.rejection_reason}</p>
                  )}
                  {(r.status === 'approved' || r.status === 'rejected') && r.approver?.name && (
                    <p className="text-xs text-muted-foreground mt-0.5">by {r.approver.name}</p>
                  )}
                </div>
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 px-2"
                      disabled={acting === r.id}
                      onClick={() => handleAction(r.id, 'approved')}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 px-2"
                      disabled={acting === r.id}
                      onClick={() => { setRejectTarget(r); setRejectDialog(true); }}>
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold">OT Approvals</h1>
            <p className="text-muted-foreground text-sm">Final approval step. Manager-approved requests appear here.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Month</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-8 text-sm w-36" />
          </div>
          <Button size="sm" variant="outline" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Awaiting Final Approval</p>
            <p className="text-2xl font-bold text-yellow-600">{awaitingAdmin.length}</p>
            <p className="text-xs text-muted-foreground">{awaitingAdmin.reduce((s, r) => s + Number(r.ot_hours), 0).toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Approved This Month</p>
            <p className="text-2xl font-bold text-green-600">{approved.length}</p>
            <p className="text-xs text-muted-foreground">{approved.reduce((s, r) => s + Number(r.ot_hours), 0).toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total OT Pay</p>
            <p className="text-2xl font-bold text-blue-600">LKR {totalApprovedPay.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold">{requests.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Awaiting Approval <Badge variant="secondary" className="ml-1 text-xs">{awaitingAdmin.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            History <Badge variant="secondary" className="ml-1 text-xs">{history.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-yellow-700">Awaiting Final Approval</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <p className="text-sm text-muted-foreground py-10 text-center">Loading...</p>
                : <RequestTable rows={awaitingAdmin} showActions />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-base">Approved / Rejected</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <p className="text-sm text-muted-foreground py-10 text-center">Loading...</p>
                : <RequestTable rows={history} showActions={false} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={open => { if (!open) { setRejectTarget(null); setRejectReason(''); } setRejectDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Reject OT Request</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {rejectTarget && (
              <div className="rounded-lg bg-muted/40 border p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Employee:</span> <strong>{rejectTarget.user?.name}</strong></p>
                <p><span className="text-muted-foreground">Date:</span> {rejectTarget.date}</p>
                <p><span className="text-muted-foreground">OT Hours:</span> {rejectTarget.ot_hours}h</p>
                <p><span className="text-muted-foreground">Est. OT Pay:</span> <span className="text-green-700 font-semibold">LKR {rejectTarget.estimated_ot_pay?.toLocaleString()}</span></p>
                {rejectTarget.reason && <p><span className="text-muted-foreground">Reason:</span> {rejectTarget.reason}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Rejection Reason (optional)</Label>
              <Textarea placeholder="Explain why this OT is rejected..." rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" disabled={acting === rejectTarget?.id}
              onClick={() => rejectTarget && handleAction(rejectTarget.id, 'rejected', rejectReason)}>
              {acting === rejectTarget?.id ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
