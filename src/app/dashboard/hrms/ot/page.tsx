'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, RefreshCw, Send } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AttendanceRecord {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
}

interface OtRequest {
  id: string;
  date: string;
  ot_hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  payroll_month: string;
}

interface OtSettings {
  calculation_method: string;
  ot_multiplier: number;
  flat_rate_per_hour: number;
  standard_hours_per_day: number;
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function fmtTime(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function calcHours(clockIn: string | null, clockOut: string | null): number {
  if (!clockIn || !clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function roundHalf(n: number) {
  return Math.round(n * 2) / 2;
}

export default function MyOtPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [userId, setUserId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [otRequests, setOtRequests] = useState<OtRequest[]>([]);
  const [settings, setSettings] = useState<OtSettings>({ calculation_method: 'multiplier', ot_multiplier: 1.5, flat_rate_per_hour: 0, standard_hours_per_day: 8 });
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [otHoursInput, setOtHoursInput] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch current user first
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user?.id) setUserId(d.user.id); });
  }, []);

  const fetchAll = () => {
    if (!userId) return;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const from = `${month}-01`;
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;

    setLoading(true);
    Promise.all([
      fetch(`/api/hrms/attendance?userId=${userId}&from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/hrms/ot-requests?month=${month}`).then(r => r.json()),
      fetch('/api/hrms/ot-settings').then(r => r.json()),
    ]).then(([attData, otData, settData]) => {
      setAttendance(attData.attendance ?? []);
      setOtRequests(otData.requests ?? []);
      if (settData.settings) setSettings(settData.settings);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [userId, month]);

  // Build per-date rows: attendance with OT calculation + request status
  const rows = useMemo(() => {
    const stdHours = Number(settings.standard_hours_per_day) || 8;
    const requestMap = new Map(otRequests.map(r => [r.date, r]));

    return attendance
      .filter(a => a.clock_in && a.clock_out) // only completed days
      .map(a => {
        const worked = calcHours(a.clock_in, a.clock_out);
        const otCalc = roundHalf(Math.max(0, worked - stdHours));
        const request = requestMap.get(a.date);
        return { ...a, worked, otCalc, request };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, otRequests, settings]);

  const totalOtCalc = rows.reduce((s, r) => s + r.otCalc, 0);
  const totalApproved = rows.filter(r => r.request?.status === 'approved').reduce((s, r) => s + Number(r.request!.ot_hours), 0);
  const pendingCount = rows.filter(r => r.request?.status === 'pending').length;

  const openDialog = (row: typeof rows[0]) => {
    setSelectedDate(row.date);
    setOtHoursInput(String(row.otCalc > 0 ? row.otCalc : ''));
    setReason('');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otHoursInput || Number(otHoursInput) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/hrms/ot-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, ot_hours: Number(otHoursInput), reason }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'OT Request Submitted', description: `Overtime request for ${selectedDate} sent for approval.` });
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      const res = await fetch(`/api/hrms/ot-requests?id=${requestId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Request Cancelled' });
      fetchAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold">My Overtime</h1>
            <p className="text-muted-foreground text-sm">OT is calculated from your clock-in / clock-out records.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Month</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-8 text-sm w-36" />
          </div>
          <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Eligible OT This Month</p>
            <p className="text-2xl font-bold text-blue-600">{totalOtCalc.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">from attendance records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Approved OT</p>
            <p className="text-2xl font-bold text-green-600">{totalApproved.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount} requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance-based OT table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daily Attendance &amp; OT — {month}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No completed attendance records for {month}. Clock in and out to see OT eligibility.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Hours Worked</TableHead>
                  <TableHead>OT Hours</TableHead>
                  <TableHead>OT Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id} className={row.otCalc > 0 ? 'bg-blue-50/30' : ''}>
                    <TableCell className="font-medium text-sm">{row.date}</TableCell>
                    <TableCell className="text-sm">{fmtTime(row.clock_in)}</TableCell>
                    <TableCell className="text-sm">{fmtTime(row.clock_out)}</TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${row.worked > Number(settings.standard_hours_per_day) ? 'text-blue-600' : 'text-muted-foreground'}`}>
                        {row.worked.toFixed(1)}h
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        (std: {settings.standard_hours_per_day}h)
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.otCalc > 0 ? (
                        <span className="font-bold text-blue-600">{row.otCalc.toFixed(1)}h</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.request ? (
                        <div>
                          <Badge className={`text-xs ${STATUS_COLORS[row.request.status]}`}>
                            {row.request.status} · {row.request.ot_hours}h
                          </Badge>
                          {row.request.status === 'rejected' && row.request.rejection_reason && (
                            <p className="text-xs text-red-600 mt-0.5">{row.request.rejection_reason}</p>
                          )}
                        </div>
                      ) : row.otCalc > 0 ? (
                        <span className="text-xs text-muted-foreground italic">Not submitted</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.request && row.otCalc > 0 && (
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => openDialog(row)}>
                          <Send className="h-3 w-3 mr-1" /> Submit OT
                        </Button>
                      )}
                      {row.request?.status === 'pending' && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleCancel(row.request!.id)}>
                          Cancel
                        </Button>
                      )}
                      {row.request?.status === 'rejected' && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => openDialog(row)}>
                          Re-submit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Submit OT Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setSelectedDate(''); setOtHoursInput(''); setReason(''); } setDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit OT Request — {selectedDate}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/40 border p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Calculated from your clock records</p>
              <p>OT hours eligible: <strong className="text-blue-600">{otHoursInput}h</strong></p>
              <p className="text-xs text-muted-foreground mt-1">You can adjust the hours below if needed.</p>
            </div>
            <div className="space-y-2">
              <Label>OT Hours to Claim</Label>
              <Input
                type="number" step="0.5"
                value={otHoursInput}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="e.g. End-of-month stock count, event setup..."
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !otHoursInput}>
                {saving ? 'Submitting...' : 'Submit OT Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
