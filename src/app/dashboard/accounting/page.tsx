'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, RefreshCw, Plus, Landmark,
  ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, CreditCard,
  Banknote, PiggyBank,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type TxType = 'income' | 'expense';

interface Transaction {
  id: string; type: TxType; description: string; amount: number;
  category: string; date: string; source?: string; meta?: string;
  department?: string;
}

interface DeptPL {
  department: string; income: number; expenses: number; net: number;
}

interface AccountingData {
  summary: { totalIncome: number; totalExpenses: number; netPL: number };
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  departmentPL: DeptPL[];
  incomes: Transaction[];
  expenses: Transaction[];
}

interface Account {
  id: string; name: string; type: string; account_number?: string;
  opening_balance: number; current_balance: number; description?: string;
  is_active: boolean; created_at: string;
}

interface AccTransaction {
  id: string; account_id: string; type: 'credit' | 'debit'; amount: number;
  description: string; reference?: string; date: string; balance_after: number;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INCOME_COLORS = ['#22c55e', '#16a34a', '#4ade80', '#86efac', '#bbf7d0'];
const EXPENSE_COLORS = ['#ef4444', '#dc2626', '#f87171', '#fca5a5', '#f97316', '#fb923c'];

const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  bank: <Landmark className="h-5 w-5" />,
  cash: <Banknote className="h-5 w-5" />,
  savings: <PiggyBank className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank: 'bg-blue-100 text-blue-700',
  cash: 'bg-green-100 text-green-700',
  savings: 'bg-purple-100 text-purple-700',
  credit_card: 'bg-orange-100 text-orange-700',
  other: 'bg-slate-100 text-slate-700',
};

const categoryColors: Record<string, string> = {
  'Room Income': 'bg-blue-100 text-blue-800',
  'Restaurant Income': 'bg-amber-100 text-amber-800',
  'Service Income': 'bg-purple-100 text-purple-800',
  'Other Income': 'bg-green-100 text-green-800',
  'Salaries': 'bg-red-100 text-red-800',
  'Daily Wages': 'bg-orange-100 text-orange-800',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `LKR ${Math.abs(n).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtFull = (n: number) =>
  `LKR ${Math.abs(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

// ─── Small Components ─────────────────────────────────────────────────────────
function SummaryCard({ title, value, icon, positive, sub }: {
  title: string; value: number; icon: React.ReactNode; positive: boolean; sub?: string;
}) {
  const color = positive ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-blue-600';
  const bg = positive ? 'bg-green-100' : value < 0 ? 'bg-red-100' : 'bg-blue-100';
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value < 0 ? '−' : ''}{fmtFull(value)}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-3 rounded-full ${bg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm space-y-1">
      <p className="font-semibold text-xs text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{fmtFull(payload[0].value)}</p>
    </div>
  );
};

function DonutChart({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground py-8 text-center">No data</p>;
  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ background: colors[i % colors.length] }} />
              <span className="capitalize truncate max-w-32">{d.name}</span>
            </div>
            <span className="text-muted-foreground font-medium">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxTable({ rows, emptyText }: { rows: Transaction[]; emptyText: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category / Source</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => (
          <TableRow key={`${r.type}-${r.id}`}>
            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{r.date}</TableCell>
            <TableCell>
              <div className="font-medium text-sm">{r.description}</div>
              {r.meta && <div className="text-xs text-muted-foreground">{r.meta}</div>}
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className={`text-xs capitalize ${categoryColors[r.category] ?? 'bg-slate-100 text-slate-700'}`}>
                {r.source || r.category}
              </Badge>
            </TableCell>
            <TableCell className={`text-right font-semibold whitespace-nowrap ${r.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
              {r.type === 'income' ? '+' : '−'} {fmtFull(r.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────
function AccountsTab() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Account | null>(null);
  const [txs, setTxs] = useState<AccTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Dialogs
  const [accountDialog, setAccountDialog] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [txDialog, setTxDialog] = useState(false);

  // Account form
  const [aName, setAName] = useState('');
  const [aType, setAType] = useState('bank');
  const [aNumber, setANumber] = useState('');
  const [aOpening, setAOpening] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aSaving, setASaving] = useState(false);

  // Transaction form
  const [tType, setTType] = useState<'credit' | 'debit'>('credit');
  const [tAmount, setTAmount] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tRef, setTRef] = useState('');
  const [tDate, setTDate] = useState(new Date().toISOString().split('T')[0]);
  const [tSaving, setTSaving] = useState(false);

  const loadAccounts = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/accounts')
      .then(r => r.json())
      .then(d => setAccounts(d.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const loadTxs = useCallback((accountId: string) => {
    setTxLoading(true);
    fetch(`/api/admin/account-transactions?accountId=${accountId}`)
      .then(r => r.json())
      .then(d => setTxs(d.transactions ?? []))
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, []);

  const openAccount = (acc: Account) => {
    setSelected(acc);
    loadTxs(acc.id);
  };

  const openAccountDialog = (acc?: Account) => {
    if (acc) {
      setEditAccount(acc);
      setAName(acc.name); setAType(acc.type);
      setANumber(acc.account_number ?? ''); setAOpening(String(acc.opening_balance));
      setADesc(acc.description ?? '');
    } else {
      setEditAccount(null);
      setAName(''); setAType('bank'); setANumber(''); setAOpening('0'); setADesc('');
    }
    setAccountDialog(true);
  };

  const saveAccount = async () => {
    if (!aName.trim()) return;
    setASaving(true);
    try {
      const body = { name: aName, type: aType, account_number: aNumber, opening_balance: Number(aOpening) || 0, description: aDesc };
      const res = await fetch('/api/admin/accounts', {
        method: editAccount ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAccount ? { ...body, id: editAccount.id } : body),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast({ title: editAccount ? 'Account updated' : 'Account created' });
      setAccountDialog(false);
      loadAccounts();
      if (selected?.id === editAccount?.id) setSelected(d.account);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setASaving(false); }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this account and all its transactions?')) return;
    const res = await fetch(`/api/admin/accounts?id=${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.error) { toast({ variant: 'destructive', title: 'Error', description: d.error }); return; }
    toast({ title: 'Account deleted' });
    if (selected?.id === id) setSelected(null);
    loadAccounts();
  };

  const saveTransaction = async () => {
    if (!selected || !tAmount || !tDesc) return;
    setTSaving(true);
    try {
      const res = await fetch('/api/admin/account-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selected.id, type: tType, amount: Number(tAmount), description: tDesc, reference: tRef, date: tDate }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast({ title: 'Transaction added' });
      setTxDialog(false);
      setTAmount(''); setTDesc(''); setTRef('');
      // Update selected account balance
      setSelected(prev => prev ? { ...prev, current_balance: d.newBalance } : null);
      setAccounts(prev => prev.map(a => a.id === selected.id ? { ...a, current_balance: d.newBalance } : a));
      loadTxs(selected.id);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setTSaving(false); }
  };

  const deleteTx = async (txId: string) => {
    const res = await fetch(`/api/admin/account-transactions?id=${txId}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.error) { toast({ variant: 'destructive', title: 'Error', description: d.error }); return; }
    toast({ title: 'Transaction deleted' });
    if (selected) { loadTxs(selected.id); loadAccounts(); }
  };

  const totalBalance = accounts.filter(a => a.is_active).reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Total across all active accounts:
            <span className={`ml-2 font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtFull(totalBalance)}
            </span>
          </p>
        </div>
        <Button onClick={() => openAccountDialog()}>
          <Plus className="mr-2 h-4 w-4" /> New Account
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account list */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No accounts yet. Click "New Account" to create one.
              </CardContent>
            </Card>
          ) : (
            accounts.map(acc => (
              <Card
                key={acc.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.id === acc.id ? 'ring-2 ring-primary' : ''} ${!acc.is_active ? 'opacity-50' : ''}`}
                onClick={() => openAccount(acc)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${ACCOUNT_TYPE_COLORS[acc.type] ?? 'bg-slate-100 text-slate-700'}`}>
                        {ACCOUNT_TYPE_ICONS[acc.type] ?? <Wallet className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{acc.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}{acc.account_number ? ` · ${acc.account_number}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openAccountDialog(acc); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteAccount(acc.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t flex items-end justify-between">
                    <p className="text-xs text-muted-foreground">Current Balance</p>
                    <p className={`text-lg font-bold ${Number(acc.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(acc.current_balance) < 0 ? '−' : ''}{fmt(acc.current_balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Transaction history */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Select an account to view transactions
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{selected.name}</CardTitle>
                  <CardDescription>
                    Balance: <span className={`font-semibold ${Number(selected.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtFull(selected.current_balance)}</span>
                    {' · '}Opening: {fmtFull(selected.opening_balance)}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200" onClick={() => { setTType('credit'); setTxDialog(true); }}>
                    <ArrowUpCircle className="h-4 w-4 mr-1" /> Deposit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => { setTType('debit'); setTxDialog(true); }}>
                    <ArrowDownCircle className="h-4 w-4 mr-1" /> Withdraw
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <p className="text-sm text-muted-foreground p-6">Loading transactions...</p>
                ) : txs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">No transactions yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txs.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                          <TableCell className="text-sm">{t.description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.reference ?? '—'}</TableCell>
                          <TableCell className={`text-right font-semibold whitespace-nowrap ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {t.type === 'credit' ? '+' : '−'} {fmtFull(t.amount)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                            {fmtFull(t.balance_after)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTx(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create / Edit Account Dialog */}
      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account Name *</Label>
                <Input placeholder="e.g. Commercial Bank" value={aName} onChange={e => setAName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={aType} onValueChange={setAType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input placeholder="Optional" value={aNumber} onChange={e => setANumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Opening Balance (LKR)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={aOpening} onChange={e => setAOpening(e.target.value)} disabled={!!editAccount} />
                {editAccount && <p className="text-xs text-muted-foreground">Use Deposit / Withdraw to adjust balance</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional notes" rows={2} value={aDesc} onChange={e => setADesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialog(false)}>Cancel</Button>
            <Button onClick={saveAccount} disabled={!aName.trim() || aSaving}>
              {aSaving ? 'Saving...' : editAccount ? 'Update' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={txDialog} onOpenChange={setTxDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={tType === 'credit' ? 'text-green-600' : 'text-red-600'}>
              {tType === 'credit' ? '↑ Deposit' : '↓ Withdrawal'} — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Button
                type="button" size="sm" variant={tType === 'credit' ? 'default' : 'outline'}
                className={tType === 'credit' ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => setTType('credit')}
              >
                <ArrowUpCircle className="h-4 w-4 mr-1" /> Deposit
              </Button>
              <Button
                type="button" size="sm" variant={tType === 'debit' ? 'destructive' : 'outline'}
                onClick={() => setTType('debit')}
              >
                <ArrowDownCircle className="h-4 w-4 mr-1" /> Withdraw
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (LKR) *</Label>
                <Input type="number" min="0.01" step="0.01" placeholder="0.00" value={tAmount} onChange={e => setTAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={tDate} onChange={e => setTDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input placeholder="e.g. Room revenue transfer" value={tDesc} onChange={e => setTDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reference / Cheque No.</Label>
              <Input placeholder="Optional" value={tRef} onChange={e => setTRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialog(false)}>Cancel</Button>
            <Button
              onClick={saveTransaction}
              disabled={!tAmount || !tDesc || tSaving}
              className={tType === 'credit' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={tType === 'debit' ? 'destructive' : 'default'}
            >
              {tSaving ? 'Saving...' : `Add ${tType === 'credit' ? 'Deposit' : 'Withdrawal'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`/api/admin/accounting?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const timeSeries = useMemo(() => {
    if (!data) return [];
    const daysDiff = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    const byMonth = daysDiff > 45;
    const key = (d: string) => byMonth ? d.slice(0, 7) : d;
    const label = (d: string) => byMonth
      ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+d.slice(5,7)-1]} ${d.slice(0,4)}`
      : d.slice(5);
    const map: Record<string, { label: string; Income: number; Expenses: number }> = {};
    for (const r of data.incomes) {
      const k = key(r.date);
      if (!map[k]) map[k] = { label: label(r.date), Income: 0, Expenses: 0 };
      map[k].Income += r.amount;
    }
    for (const r of data.expenses) {
      const k = key(r.date);
      if (!map[k]) map[k] = { label: label(r.date), Income: 0, Expenses: 0 };
      map[k].Expenses += r.amount;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [data, from, to]);

  const incomeChartData = useMemo(() =>
    Object.entries(data?.incomeByCategory ?? {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    [data]);

  const expenseChartData = useMemo(() =>
    Object.entries(data?.expenseByCategory ?? {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    [data]);

  const ledger = useMemo(() =>
    data ? [...data.incomes, ...data.expenses].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Accounting</h1>
            <p className="text-muted-foreground text-sm">Income, expenses, and account balances</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
          </div>
          <Button size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Apply'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard title="Total Income" value={data.summary.totalIncome} icon={<TrendingUp className="h-5 w-5 text-green-600" />} positive={true} sub={`${data.incomes.length} transactions`} />
          <SummaryCard title="Total Expenses" value={data.summary.totalExpenses} icon={<TrendingDown className="h-5 w-5 text-red-600" />} positive={false} sub={`${data.expenses.length} transactions`} />
          <SummaryCard title="Net Profit / Loss" value={data.summary.netPL} icon={<Wallet className={`h-5 w-5 ${data.summary.netPL >= 0 ? 'text-blue-600' : 'text-red-600'}`} />} positive={data.summary.netPL >= 0} sub={data.summary.netPL >= 0 ? 'Profit' : 'Loss'} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="income">Income <Badge variant="secondary" className="ml-1 text-xs">{data?.incomes.length ?? 0}</Badge></TabsTrigger>
          <TabsTrigger value="expenses">Expenses <Badge variant="secondary" className="ml-1 text-xs">{data?.expenses.length ?? 0}</Badge></TabsTrigger>
          <TabsTrigger value="ledger">All Transactions <Badge variant="secondary" className="ml-1 text-xs">{ledger.length}</Badge></TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Income vs Expenses</CardTitle></CardHeader>
            <CardContent>
              {!timeSeries.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={timeSeries} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {timeSeries.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Net Profit / Loss Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeSeries.map(d => ({ ...d, 'Net P&L': d.Income - d.Expenses }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="Net P&L" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base text-green-600">Income Breakdown</CardTitle></CardHeader>
              <CardContent><DonutChart data={incomeChartData} colors={INCOME_COLORS} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base text-red-600">Expense Breakdown</CardTitle></CardHeader>
              <CardContent><DonutChart data={expenseChartData} colors={EXPENSE_COLORS} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          {!data || !data.departmentPL?.length ? (
            <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No data in this period.</CardContent></Card>
          ) : (
            <>
              {/* Bar chart */}
              <Card>
                <CardHeader><CardTitle className="text-base">Department P&amp;L Overview</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.departmentPL} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4,4,0,0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Department cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.departmentPL.map(d => (
                  <Card key={d.department}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{d.department}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Income</span>
                        <span className="font-medium text-green-600">{fmtFull(d.income)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expenses</span>
                        <span className="font-medium text-red-600">{fmtFull(d.expenses)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm font-bold">
                        <span>Net</span>
                        <span className={d.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {d.net >= 0 ? '+' : '−'}{fmtFull(Math.abs(d.net))}
                        </span>
                      </div>
                      {/* Mini progress bar showing expense ratio */}
                      {d.income > 0 && (
                        <div className="mt-1">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded-full"
                              style={{ width: `${Math.min(100, (d.expenses / d.income) * 100).toFixed(1)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cost ratio: {d.income > 0 ? ((d.expenses / d.income) * 100).toFixed(1) : '—'}%
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Detailed table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Department Summary Table</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right text-green-600">Income</TableHead>
                        <TableHead className="text-right text-red-600">Expenses</TableHead>
                        <TableHead className="text-right">Net P&amp;L</TableHead>
                        <TableHead className="text-right">Cost %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.departmentPL.map(d => (
                        <TableRow key={d.department}>
                          <TableCell className="font-medium">{d.department}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">{fmtFull(d.income)}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">{fmtFull(d.expenses)}</TableCell>
                          <TableCell className={`text-right font-bold ${d.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {d.net >= 0 ? '+' : '−'}{fmtFull(Math.abs(d.net))}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {d.income > 0 ? `${((d.expenses / d.income) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="font-bold border-t-2 bg-muted/30">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-green-600">{fmtFull(data.summary.totalIncome)}</TableCell>
                        <TableCell className="text-right text-red-600">{fmtFull(data.summary.totalExpenses)}</TableCell>
                        <TableCell className={`text-right ${data.summary.netPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.summary.netPL >= 0 ? '+' : '−'}{fmtFull(Math.abs(data.summary.netPL))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.summary.totalIncome > 0 ? `${((data.summary.totalExpenses / data.summary.totalIncome) * 100).toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="income">
          <Card><CardContent className="pt-4"><TxTable rows={data?.incomes ?? []} emptyText="No income in this period." /></CardContent></Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card><CardContent className="pt-4"><TxTable rows={data?.expenses ?? []} emptyText="No expenses in this period." /></CardContent></Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card><CardContent className="pt-4"><TxTable rows={ledger} emptyText="No transactions in this period." /></CardContent></Card>
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
