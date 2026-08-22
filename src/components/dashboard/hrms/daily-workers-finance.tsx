'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Banknote, Clock3, HandCoins, RefreshCw, Users, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useRouter, useSearchParams } from 'next/navigation';

type Account = { id: string; name: string; type: string; current_balance: number };
type CashRequest = {
  id: string; request_number: string; work_date: string; purpose: string; status: string;
  requested_amount: number; issued_amount: number; amount_to_issue: number; spent_amount: number; balance: number;
  requester?: { name: string } | null;
};
type FinanceData = {
  requests: CashRequest[]; accounts: Account[];
  summary: { requested: number; issued: number; to_issue: number; spent: number; balance: number };
};

const money = (value: number) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DailyWorkerDaySummary({ present, toPay, paid, requested, issued, toIssue, balance }: {
  present: number; toPay: number; paid: number; requested: number; issued: number; toIssue: number; balance: number;
}) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
    <Summary label="Present" value={present} icon={Users} plainNumber />
    <Summary label="To Pay" value={toPay} icon={Clock3} />
    <Summary label="Paid" value={paid} icon={Banknote} />
    <Summary label="Requested" value={requested} icon={Wallet} />
    <Summary label="Issued" value={issued} icon={HandCoins} />
    <Summary label="To Issue" value={toIssue} icon={Clock3} />
    <Summary label="Available Balance" value={balance} icon={Wallet} />
  </div>;
}

export function DailyWorkersFinance({ accountsOnly = false }: { accountsOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedDate = searchParams.get('date');
  const initialDate = linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate)
    ? linkedDate
    : new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const { toast } = useToast();
  const { user } = useUserContext();
  const canIssue = user?.role === 'admin' || user?.role === 'payment';
  const showIssuanceControls = accountsOnly && canIssue;
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [requestForm, setRequestForm] = useState({ work_date: initialDate, purpose: 'Daily worker wages', requested_amount: '' });
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestPage, setRequestPage] = useState(1);
  const [dailyEstimate, setDailyEstimate] = useState<{ workers: number; amount: number } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, toPay: 0, paid: 0 });
  const [issueRequest, setIssueRequest] = useState<CashRequest | null>(null);
  const [issueAccount, setIssueAccount] = useState('');
  const [issueAmount, setIssueAmount] = useState('');
  const [issueSaving, setIssueSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = accountsOnly ? '/api/hrms/daily-worker-finance' : `/api/hrms/daily-worker-finance?date=${selectedDate}`;
      const response = await fetch(endpoint, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load finance data.');
      setData(payload);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Finance error', description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [accountsOnly, selectedDate, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (accountsOnly || !selectedDate) return;
    setEstimateLoading(true);
    fetch(`/api/hrms/daily-payments?date=${selectedDate}`)
      .then(response => response.json())
      .then(payload => {
        const workers = payload.workers || [];
        const presentWorkers = workers.filter((worker: { payment?: { day_type?: string } | null }) =>
          worker.payment && worker.payment.day_type !== 'absent');
        const payableWorkers = workers.filter((worker: { payment?: { day_type?: string; is_paid?: boolean } | null }) =>
          worker.payment && worker.payment.day_type !== 'absent' && !worker.payment.is_paid);
        const amount = payableWorkers.reduce((sum: number, worker: { payment?: { amount?: number } | null }) =>
          sum + Number(worker.payment?.amount || 0), 0);
        const paid = workers.filter((worker: { payment?: { is_paid?: boolean } | null }) => worker.payment?.is_paid)
          .reduce((sum: number, worker: { payment?: { amount?: number } | null }) => sum + Number(worker.payment?.amount || 0), 0);
        setDailyEstimate({ workers: payableWorkers.length, amount });
        setAttendanceSummary({ present: presentWorkers.length, toPay: amount, paid });
      })
      .catch(() => { setDailyEstimate(null); setAttendanceSummary({ present: 0, toPay: 0, paid: 0 }); })
      .finally(() => setEstimateLoading(false));
  }, [accountsOnly, selectedDate]);

  const alreadyRequested = Number(data?.summary.requested || 0);
  const remainingToRequest = Math.max(0, attendanceSummary.toPay - alreadyRequested);

  useEffect(() => {
    if (accountsOnly) return;
    setRequestForm(form => ({
      ...form,
      requested_amount: remainingToRequest > 0 ? String(remainingToRequest) : '',
    }));
  }, [accountsOnly, remainingToRequest]);

  const submitRequest = async () => {
    setRequestSaving(true);
    try {
      const response = await fetch('/api/hrms/daily-worker-finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestForm, requested_amount: remainingToRequest }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Request failed.');
      setRequestPage(1);
      toast({ title: 'Money requested', description: 'The request is ready for Accounts to issue.' });
      load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Request failed', description: (error as Error).message });
    } finally { setRequestSaving(false); }
  };

  const openIssue = (request: CashRequest) => {
    setIssueRequest(request);
    setIssueAmount(String(request.amount_to_issue));
    setIssueAccount('');
  };

  const issueMoney = async () => {
    if (!issueRequest) return;
    setIssueSaving(true);
    try {
      const response = await fetch('/api/hrms/daily-worker-finance', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: issueRequest.id, account_id: issueAccount, amount: issueAmount }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Issuance failed.');
      toast({ title: 'Money issued', description: 'The account balance and request balance were updated.' });
      setIssueRequest(null);
      load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Issue failed', description: (error as Error).message });
    } finally { setIssueSaving(false); }
  };

  const summary = data?.summary || { requested: 0, issued: 0, to_issue: 0, spent: 0, balance: 0 };
  const requestsPerPage = 10;
  const requests = data?.requests || [];
  const requestPageCount = Math.max(1, Math.ceil(requests.length / requestsPerPage));
  const safeRequestPage = Math.min(requestPage, requestPageCount);
  const paginatedRequests = requests.slice((safeRequestPage - 1) * requestsPerPage, safeRequestPage * requestsPerPage);

  return <div className="space-y-6">
    {!accountsOnly && <Button variant="ghost" className="-ml-3" onClick={() => router.back()}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Back to Daily Workers
    </Button>}
    <div className="flex items-center justify-between">
      <div><h2 className="text-2xl font-bold">{accountsOnly ? 'Daily Workers Finance' : 'Daily Worker Money Requests'}</h2><p className="text-muted-foreground">{accountsOnly ? 'Issue requested wage funds from Accounts and monitor balances.' : 'Request wage funds from Accounts and monitor the amount received and remaining.'}</p></div>
      {!accountsOnly && <Input type="date" value={selectedDate} onChange={event => { setSelectedDate(event.target.value); setRequestForm(form => ({ ...form, work_date: event.target.value })); }} className="w-auto" />}
      <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
    </div>
    {accountsOnly ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Requested" value={summary.requested} icon={Wallet} />
        <Summary label="Issued" value={summary.issued} icon={HandCoins} />
        <Summary label="Amount to Issue" value={summary.to_issue} icon={Clock3} />
        <Summary label="Wages Paid" value={summary.spent} icon={Banknote} />
        <Summary label="Available Balance" value={summary.balance} icon={Wallet} />
      </div> : <DailyWorkerDaySummary present={attendanceSummary.present} toPay={attendanceSummary.toPay} paid={attendanceSummary.paid} requested={summary.requested} issued={summary.issued} toIssue={summary.to_issue} balance={summary.balance} />}
    {!accountsOnly && <Card>
      <CardHeader><CardTitle>Request Money from Accounts</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div><Label>Work Date</Label><Input type="date" value={requestForm.work_date} onChange={event => { setSelectedDate(event.target.value); setRequestForm(form => ({ ...form, work_date: event.target.value })); }} /></div>
        <div><Label>Requested Amount</Label><Input type="number" min="0.01" step="0.01" value={requestForm.requested_amount} readOnly className="bg-muted/40 font-semibold" />
          <p className="mt-1 text-xs text-muted-foreground">{estimateLoading ? 'Calculating amount to pay…' : dailyEstimate ? `${dailyEstimate.workers} unpaid worker(s) · To Pay ${money(dailyEstimate.amount)} · Already requested ${money(alreadyRequested)}` : 'No attendance data found for this date.'}</p>
        </div>
        <div className="md:col-span-2"><Label>Purpose</Label><Textarea className="min-h-10" value={requestForm.purpose} onChange={event => setRequestForm(form => ({ ...form, purpose: event.target.value }))} /></div>
        <div className="md:col-span-4"><Button onClick={submitRequest} disabled={requestSaving || remainingToRequest <= 0}>{requestSaving ? 'Requesting…' : remainingToRequest > 0 ? 'Submit Money Request' : 'Fully Requested'}</Button></div>
      </CardContent>
    </Card>}
    {issueRequest && showIssuanceControls && <Card className="border-primary/30">
      <CardHeader><CardTitle>Issue Money — {issueRequest.request_number}</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div><Label>Source Account</Label><Select value={issueAccount} onValueChange={setIssueAccount}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{(data?.accounts || []).map(account => <SelectItem key={account.id} value={account.id}>{account.name} — {money(account.current_balance)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Amount to Issue</Label><Input type="number" min="0.01" max={issueRequest.amount_to_issue} step="0.01" value={issueAmount} onChange={event => setIssueAmount(event.target.value)} /></div>
        <div className="flex items-end gap-2"><Button onClick={issueMoney} disabled={issueSaving || !issueAccount}>{issueSaving ? 'Issuing…' : 'Confirm Issue'}</Button><Button variant="outline" onClick={() => setIssueRequest(null)}>Cancel</Button></div>
      </CardContent>
    </Card>}
    <Card><CardHeader><CardTitle>Money Requests</CardTitle></CardHeader><CardContent>
      <div className="overflow-x-auto">
      <Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Date / Purpose</TableHead><TableHead>Requested</TableHead><TableHead>Issued</TableHead><TableHead>To Issue</TableHead><TableHead>Spent</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead>{showIssuanceControls && <TableHead />}</TableRow></TableHeader>
      <TableBody>{!requests.length ? <TableRow><TableCell colSpan={showIssuanceControls ? 9 : 8} className="py-10 text-center text-muted-foreground">No money requests found.</TableCell></TableRow> : paginatedRequests.map(request => <TableRow key={request.id}>
        <TableCell><div className="font-medium">{request.request_number}</div><div className="text-xs text-muted-foreground">{request.requester?.name}</div></TableCell>
        <TableCell><div>{request.work_date}</div><div className="max-w-48 truncate text-xs text-muted-foreground">{request.purpose}</div></TableCell>
        <TableCell>{money(request.requested_amount)}</TableCell><TableCell>{money(request.issued_amount)}</TableCell><TableCell>{money(request.amount_to_issue)}</TableCell><TableCell>{money(request.spent_amount)}</TableCell><TableCell className={request.balance < 0 ? 'text-red-600' : 'text-emerald-600'}>{money(request.balance)}</TableCell><TableCell><Badge variant="outline" className="capitalize">{request.status.replace('_', ' ')}</Badge></TableCell>
        {showIssuanceControls && <TableCell>{request.amount_to_issue > 0 && <Button size="sm" onClick={() => openIssue(request)}>Issue</Button>}</TableCell>}
      </TableRow>)}</TableBody></Table>
      </div>
      {requests.length > requestsPerPage && <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Showing {(safeRequestPage - 1) * requestsPerPage + 1}–{Math.min(safeRequestPage * requestsPerPage, requests.length)} of {requests.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={safeRequestPage === 1} onClick={() => setRequestPage(page => Math.max(1, page - 1))}>Previous</Button>
          <span className="text-sm">Page {safeRequestPage} of {requestPageCount}</span>
          <Button variant="outline" size="sm" disabled={safeRequestPage === requestPageCount} onClick={() => setRequestPage(page => Math.min(requestPageCount, page + 1))}>Next</Button>
        </div>
      </div>}
    </CardContent></Card>
  </div>;
}

function Summary({ label, value, icon: Icon, plainNumber = false }: { label: string; value: number; icon: typeof Wallet; plainNumber?: boolean }) {
  return <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{plainNumber ? value : money(value)}</p></div><div className="rounded-full bg-primary/10 p-3"><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card>;
}
