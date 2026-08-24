'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Banknote, Clock3, HandCoins, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

type Totals = { requested: number; issued: number; paid: number; outstanding: number; available: number };
type DailyRequest = { work_date: string; requested_amount: number; issued_amount: number; spent_amount: number; amount_to_issue: number };
type ExpenseRequest = { expense_date: string; requested_amount: number; issued_amount: number; amount_to_issue: number; items?: Array<{ expense_id: string; amount: number }> };
type Expense = { id: string; is_paid?: boolean };

const emptyTotals = (): Totals => ({ requested: 0, issued: 0, paid: 0, outstanding: 0, available: 0 });
const money = (value: number) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinanceRequestsReportPage() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [dailyRequests, setDailyRequests] = useState<DailyRequest[]>([]);
  const [expenseRequests, setExpenseRequests] = useState<ExpenseRequest[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'all' | 'date' | 'month' | 'year'>('all');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));

  useEffect(() => {
    Promise.all([
      fetch('/api/hrms/daily-worker-finance', { cache: 'no-store' }),
      fetch('/api/admin/expense-funding-requests', { cache: 'no-store' }),
      fetch('/api/admin/expenses', { cache: 'no-store' }),
    ]).then(async responses => {
      const payloads = await Promise.all(responses.map(response => response.json()));
      const failedIndex = responses.findIndex(response => !response.ok);
      if (failedIndex >= 0) throw new Error(payloads[failedIndex].error || 'Failed to load report.');
      setDailyRequests(payloads[0].requests || []);
      setExpenseRequests(payloads[1].requests || []);
      setExpenses(payloads[2].expenses || []);
    }).catch(error => toast({ variant: 'destructive', title: 'Report error', description: error.message }))
      .finally(() => setLoading(false));
  }, [toast]);

  const matchesPeriod = (value: string) => {
    if (period === 'date') return value.slice(0, 10) === date;
    if (period === 'month') return value.slice(0, 7) === month;
    if (period === 'year') return value.slice(0, 4) === year;
    return true;
  };

  const report = useMemo(() => {
    const paidExpenseIds = new Set(expenses.filter(expense => expense.is_paid).map(expense => expense.id));
    const daily = dailyRequests.filter(request => matchesPeriod(request.work_date)).reduce((totals, request) => ({
      requested: totals.requested + Number(request.requested_amount || 0),
      issued: totals.issued + Number(request.issued_amount || 0),
      paid: totals.paid + Number(request.spent_amount || 0),
      outstanding: totals.outstanding + Number(request.amount_to_issue || 0),
      available: totals.available + Number(request.issued_amount || 0) - Number(request.spent_amount || 0),
    }), emptyTotals());
    const otherExpenses = expenseRequests.filter(request => matchesPeriod(request.expense_date)).reduce((totals, request) => {
      const paid = (request.items || []).filter(item => paidExpenseIds.has(item.expense_id))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return {
        requested: totals.requested + Number(request.requested_amount || 0),
        issued: totals.issued + Number(request.issued_amount || 0),
        paid: totals.paid + paid,
        outstanding: totals.outstanding + Number(request.amount_to_issue || 0),
        available: totals.available + Number(request.issued_amount || 0) - paid,
      };
    }, emptyTotals());
    const overall = (Object.keys(daily) as Array<keyof Totals>).reduce((totals, key) => ({ ...totals, [key]: daily[key] + otherExpenses[key] }), emptyTotals());
    return { daily, otherExpenses, overall };
  }, [dailyRequests, expenseRequests, expenses, period, date, month, year]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Finance Requests Overall Report</h1><p className="text-muted-foreground">Combined and type-specific funding performance.</p></div>
      <Button asChild variant="outline"><Link href="/dashboard/accounting/daily-workers-finance"><ArrowLeft className="mr-2 h-4 w-4" />Finance Requests</Link></Button>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
      <Label>Report period</Label>
      <Select value={period} onValueChange={value => setPeriod(value as typeof period)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All time</SelectItem><SelectItem value="date">Date-wise</SelectItem><SelectItem value="month">Month-wise</SelectItem><SelectItem value="year">Year-wise</SelectItem></SelectContent></Select>
      {period === 'date' && <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-auto" />}
      {period === 'month' && <Input type="month" value={month} onChange={event => setMonth(event.target.value)} className="w-auto" />}
      {period === 'year' && <Input type="number" min="2000" max="2100" value={year} onChange={event => setYear(event.target.value)} className="w-28" />}
    </div>

    <section className="space-y-3"><h2 className="text-xl font-semibold">Overall</h2><TotalsCards totals={report.overall} loading={loading} paidLabel="Paid / Settled" availableLabel="Available / To Settle" /></section>
    <div className="grid gap-6 xl:grid-cols-2">
      <ReportSection title="Daily Workers" totals={report.daily} loading={loading} paidLabel="Paid" availableLabel="Available" />
      <ReportSection title="Other Expenses" totals={report.otherExpenses} loading={loading} paidLabel="Settled" availableLabel="To Settle" />
    </div>
  </div>;
}

function TotalsCards({ totals, loading, paidLabel, availableLabel }: { totals: Totals; loading: boolean; paidLabel: string; availableLabel: string }) {
  const items = [
    ['Requested', totals.requested, Wallet], ['Issued by Finance', totals.issued, HandCoins], [paidLabel, totals.paid, Banknote],
    ['To Issue', totals.outstanding, Clock3], [availableLabel, totals.available, Wallet],
  ] as const;
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{items.map(([label, value, Icon]) => <Card key={label}><CardContent className="flex min-h-20 items-center justify-between p-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-base font-bold">{loading ? '…' : money(value)}</p></div><Icon className="h-4 w-4 text-primary" /></CardContent></Card>)}</div>;
}

function ReportSection({ title, totals, loading, paidLabel, availableLabel }: { title: string; totals: Totals; loading: boolean; paidLabel: string; availableLabel: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{Object.entries({ Requested: totals.requested, 'Issued by Finance': totals.issued, [paidLabel]: totals.paid, 'To Issue': totals.outstanding, [availableLabel]: totals.available }).map(([label, value]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell className="text-right font-medium">{loading ? '…' : money(value)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}
