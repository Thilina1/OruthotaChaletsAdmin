'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRightLeft, Banknote, Loader2, RefreshCw, WalletCards } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const money = (value: number) => `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RestaurantAccountPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any>({ summary: {}, transfers: [], accounts: [] });
  const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [accountId, setAccountId] = useState(''); const [amount, setAmount] = useState(''); const [notes, setNotes] = useState('');
  const [cardAccountId, setCardAccountId] = useState(''); const [savingCardAccount, setSavingCardAccount] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch('/api/admin/restaurant-account', { cache: 'no-store' }); const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || 'Failed to load restaurant account.'); setData(result); setCardAccountId(result.settings?.card_account_id || ''); }
    catch (error: any) { toast({ variant: 'destructive', title: 'Restaurant Account Unavailable', description: error.message }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  const transfer = async () => {
    const numericAmount = Number(amount); if (!accountId || numericAmount <= 0 || numericAmount > Number(data.summary.available_cash || 0)) return;
    setSaving(true);
    try { const response = await fetch('/api/admin/restaurant-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: accountId, amount: numericAmount, notes }) }); const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || 'Transfer failed.'); toast({ title: 'Cash Transferred', description: `${money(numericAmount)} posted to the selected account.` }); setOpen(false); setAmount(''); setNotes(''); setAccountId(''); await load(); }
    catch (error: any) { toast({ variant: 'destructive', title: 'Transfer Failed', description: error.message }); }
    finally { setSaving(false); }
  };
  const saveCardAccount = async () => {
    if (!cardAccountId) return; setSavingCardAccount(true);
    try { const response = await fetch('/api/admin/restaurant-account', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_account_id: cardAccountId }) }); const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || 'Failed to save card account.'); toast({ title: 'Card Payment Account Saved', description: 'Future restaurant card payments will post directly to this account.' }); await load(); }
    catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message }); }
    finally { setSavingCardAccount(false); }
  };
  const summary = data.summary || {};
  const cards = [{ label: 'Available Cash', value: summary.available_cash, sub: 'Ready to transfer', color: 'text-emerald-600' }, { label: 'Total Cash Collected', value: summary.gross_cash, sub: `${summary.cash_bill_count || 0} cash bills`, color: 'text-slate-900' }, { label: 'Transferred to Accounts', value: summary.transferred_cash, sub: 'All completed transfers', color: 'text-blue-600' }, { label: 'Card Payments', value: summary.card_total, sub: `${summary.card_bill_count || 0} card bills · posted automatically`, color: 'text-violet-600' }, { label: "Today's Cash", value: summary.today_cash, sub: 'Cash bills paid today', color: 'text-amber-600' }];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><WalletCards className="h-7 w-7 text-primary" /> Restaurant Account</h1><p className="mt-1 text-muted-foreground">Monitor restaurant cash collections and transfer available cash into Accounting accounts.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button onClick={() => setOpen(true)} disabled={loading || Number(summary.available_cash || 0) <= 0}><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer to Account</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(card => <Card key={card.label}><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{card.label}</p><p className={`mt-2 text-2xl font-black ${card.color}`}>{loading ? '—' : money(card.value)}</p><p className="mt-1 text-xs text-muted-foreground">{card.sub}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">Card Payment Account</CardTitle><CardDescription>Select where restaurant card payments should be deposited automatically. A card payment cannot be completed until this is configured.</CardDescription></CardHeader><CardContent><div className="flex max-w-2xl flex-col gap-3 sm:flex-row"><Select value={cardAccountId} onValueChange={setCardAccountId}><SelectTrigger className="flex-1"><SelectValue placeholder="Select destination account" /></SelectTrigger><SelectContent>{data.accounts.map((account: any) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.type.replaceAll('_', ' ')} · {money(account.current_balance)}</SelectItem>)}</SelectContent></Select><Button onClick={saveCardAccount} disabled={!cardAccountId || savingCardAccount}>{savingCardAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Card Account</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4" /> Transfer History</CardTitle><CardDescription>Restaurant cash posted into Accounting accounts.</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Destination Account</TableHead><TableHead>Notes</TableHead><TableHead>Transferred By</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.transfers.map((row: any) => <TableRow key={row.id}><TableCell className="whitespace-nowrap">{format(new Date(row.created_at), 'dd MMM yyyy HH:mm')}</TableCell><TableCell><span className="font-medium">{row.account?.name || '—'}</span><Badge variant="outline" className="ml-2 text-[9px]">{row.account?.type || 'account'}</Badge></TableCell><TableCell className="max-w-xs text-muted-foreground">{row.notes || '—'}</TableCell><TableCell>{row.user?.name || '—'}</TableCell><TableCell className="text-right font-bold text-emerald-600">{money(row.amount)}</TableCell></TableRow>)}{!loading && data.transfers.length === 0 && <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No restaurant cash transfers yet.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <Dialog open={open} onOpenChange={value => !saving && setOpen(value)}><DialogContent><DialogHeader><DialogTitle>Transfer Restaurant Cash</DialogTitle><DialogDescription>Available: <strong>{money(summary.available_cash)}</strong>. This credits the selected Accounting account and creates an audit record.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Destination account *</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{data.accounts.map((account: any) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.type.replaceAll('_', ' ')} · {money(account.current_balance)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Amount *</Label><Input type="number" min="0.01" max={summary.available_cash} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" />{Number(amount) > Number(summary.available_cash || 0) && <p className="text-xs text-destructive">Amount exceeds available restaurant cash.</p>}</div><div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Deposit reference or transfer notes" /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button onClick={transfer} disabled={saving || !accountId || Number(amount) <= 0 || Number(amount) > Number(summary.available_cash || 0)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Transfer</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
