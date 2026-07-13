'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Clock, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OtRequest {
  id: string;
  date: string;
  ot_hours: number;
  reason: string;
  status: string;
  rejection_reason?: string;
  payroll_month: string;
  estimated_ot_pay: number;
  user?: { id: string; name: string; job_title?: string; department?: string } | null;
}

export default function ManagerOtApprovalsPage() {
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
    fetch(`/api/hrms/ot-requests?asManager=true&month=${month}&status=pending`)
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, [month]);

  const handleAction = async (id: string, status: 'manager_approved' | 'rejected', rejection_reason?: string) => {
    setActing(id);
    try {
      const res = await fetch('/api/hrms/ot-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, rejection_reason }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const label = status === 'manager_approved' ? 'Approved' : 'Rejected';
      toast({ title: `OT ${label}`, description: `Request for ${data.request?.user?.name} has been ${label.toLowerCase()}.` });
      setRequests(prev => prev.filter(r => r.id !== id));
      setRejectDialog(false);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActing(null);
    }
  };

  const pendingHours = requests.reduce((s, r) => s + Number(r.ot_hours), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manager OT Approvals</h1>
            <p className="text-muted-foreground text-sm">First-level approval for your team's overtime requests.</p>
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Pending From Your Team</p>
            <p className="text-2xl font-bold text-yellow-600">{requests.length} requests</p>
            <p className="text-xs text-muted-foreground">{pendingHours.toFixed(1)} hours total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Estimated OT Pay</p>
            <p className="text-2xl font-bold text-blue-600">
              LKR {requests.reduce((s, r) => s + (r.estimated_ot_pay ?? 0), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Requests table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-yellow-700">
            Awaiting Your Approval — {month}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No pending OT requests from your team.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>OT Hours</TableHead>
                  <TableHead>Est. OT Pay</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.user?.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.user?.job_title}{r.user?.department ? ` · ${r.user.department}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.date}</TableCell>
                    <TableCell className="font-bold text-blue-600">{r.ot_hours}h</TableCell>
                    <TableCell className="font-semibold text-green-700">
                      {r.estimated_ot_pay > 0 ? `LKR ${r.estimated_ot_pay.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.reason || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 px-2"
                          disabled={acting === r.id}
                          onClick={() => handleAction(r.id, 'manager_approved')}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2"
                          disabled={acting === r.id}
                          onClick={() => { setRejectTarget(r); setRejectDialog(true); }}>
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                {rejectTarget.reason && <p><span className="text-muted-foreground">Reason:</span> {rejectTarget.reason}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Rejection Reason (optional)</Label>
              <Textarea placeholder="Explain why..." rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
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
