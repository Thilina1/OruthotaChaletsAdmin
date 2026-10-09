'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type RateRow = {
    id: string;
    rate_date: string;
    market_rate: number | null;
    margin_percent: number;
    applied_rate: number;
    source: string;
    is_manual: boolean;
    created_at: string;
    user?: { name?: string } | null;
};

type Status = {
    settings: { mode: 'auto' | 'manual'; margin_percent: number };
    today: string;
    rate_in_use: number;
    latest: RateRow | null;
    history: RateRow[];
    warning?: string | null;
};

const lkr = (value: number | null | undefined) => Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Live USD→LKR rate for the Rate Matrix. Reports the rate prices use and
// whether it is set automatically, so the page can lock its rate field.
export function ExchangeRateCard({ onChange }: { onChange: (rate: number, mode: 'auto' | 'manual') => void }) {
    const { toast } = useToast();
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [margin, setMargin] = useState('');
    const [manualRate, setManualRate] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    const applyStatus = useCallback((data: Status) => {
        setStatus(data);
        setMargin(String(data.settings.margin_percent));
        if (data.rate_in_use > 0) onChange(data.rate_in_use, data.settings.mode);
        else onChange(0, data.settings.mode);
        if (data.warning) toast({ variant: 'destructive', title: 'Live rate unavailable', description: data.warning });
    }, [onChange, toast]);

    const call = useCallback(async (key: string, init?: RequestInit) => {
        setBusy(key);
        try {
            const res = await fetch('/api/admin/exchange-rate', { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            applyStatus(data);
            return data;
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Exchange rate', description: error.message });
            return null;
        } finally {
            setBusy(null);
        }
    }, [applyStatus, toast]);

    useEffect(() => { void call('load'); }, [call]);

    if (!status) {
        return (
            <Card><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading exchange rate…
            </CardContent></Card>
        );
    }

    const latest = status.latest;
    const auto = status.settings.mode === 'auto';
    const latestIsToday = latest?.rate_date === status.today;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            USD → LKR Exchange Rate
                            <Badge variant="outline" className={auto ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-600'}>{auto ? 'Auto (daily)' : 'Manual'}</Badge>
                        </CardTitle>
                        <CardDescription>
                            Used for foreign-guest prices and LKR totals. New bookings lock the rate of the day they are made.
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">Rate in use</p>
                        <p className="text-2xl font-bold">LKR {lkr(status.rate_in_use)}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {latest && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                        <p>
                            Latest: <span className="font-semibold">LKR {lkr(latest.applied_rate)}</span>
                            {latest.market_rate ? <> (market {lkr(latest.market_rate)} − {Number(latest.margin_percent)}%)</> : null}
                            {' · '}{latest.source}{latest.is_manual && latest.user?.name ? ` by ${latest.user.name}` : ''}
                            {' · '}{format(new Date(latest.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                        {auto && !latestIsToday && (
                            <p className="mt-1 flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Today&apos;s rate has not been fetched yet; the last saved rate is in use.</p>
                        )}
                        {!auto && latest.market_rate && Math.abs(latest.applied_rate - status.rate_in_use) > 0.01 && (
                            <p className="mt-1 text-muted-foreground">Manual mode: prices use LKR {lkr(status.rate_in_use)}, not the fetched rate.</p>
                        )}
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                        <Label>Mode</Label>
                        <Select
                            value={status.settings.mode}
                            onValueChange={value => void call('mode', { method: 'PUT', body: JSON.stringify({ mode: value }) })}
                            disabled={busy !== null}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Auto: live rate every day</SelectItem>
                                <SelectItem value="manual">Manual: I set the rate</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Margin below market (%)</Label>
                        <div className="flex gap-2">
                            <Input type="number" min={0} max={20} step={0.1} value={margin} onChange={e => setMargin(e.target.value)} />
                            <Button
                                variant="outline"
                                disabled={busy !== null || Number(margin) === status.settings.margin_percent}
                                onClick={() => void call('margin', { method: 'PUT', body: JSON.stringify({ margin_percent: Number(margin) }) })}
                            >
                                {busy === 'margin' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Banks and PayHere pay less than the market rate.</p>
                    </div>
                    <div className="space-y-1">
                        <Label>Set today&apos;s rate by hand</Label>
                        <div className="flex gap-2">
                            <Input type="number" min={0} step={0.01} placeholder="e.g. CBSL rate" value={manualRate} onChange={e => setManualRate(e.target.value)} />
                            <Button
                                variant="outline"
                                disabled={busy !== null || !(Number(manualRate) > 0)}
                                onClick={async () => {
                                    const data = await call('manual', { method: 'POST', body: JSON.stringify({ action: 'manual', rate: Number(manualRate) }) });
                                    if (data) { setManualRate(''); toast({ title: 'Rate set', description: `LKR ${lkr(Number(manualRate))} applied to all room rates.` }); }
                                }}
                            >
                                {busy === 'manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{auto ? 'Overrides the live rate for today only.' : 'Applies straight away.'}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        disabled={busy !== null}
                        onClick={async () => {
                            const data = await call('refresh', { method: 'POST', body: JSON.stringify({ action: 'refresh' }) });
                            if (data) toast({ title: 'Live rate fetched', description: data.applied ? `LKR ${lkr(data.rate_in_use)} applied to all room rates.` : 'Saved to history. Manual mode keeps your own rate.' });
                        }}
                    >
                        {busy === 'refresh' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Fetch live rate now
                    </Button>
                    <Button variant="ghost" onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Hide history' : 'Show history'}</Button>
                </div>

                {showHistory && (
                    <div className="max-h-64 overflow-y-auto rounded-md border text-sm">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-muted text-left text-xs">
                                <tr><th className="p-2">Date</th><th className="p-2 text-right">Market</th><th className="p-2 text-right">Margin</th><th className="p-2 text-right">Applied</th><th className="p-2">Source</th></tr>
                            </thead>
                            <tbody>
                                {status.history.map(row => (
                                    <tr key={row.id} className="border-t">
                                        <td className="p-2">{format(new Date(row.created_at), 'dd MMM yyyy HH:mm')}</td>
                                        <td className="p-2 text-right">{row.market_rate ? lkr(row.market_rate) : '—'}</td>
                                        <td className="p-2 text-right">{row.is_manual ? '—' : `${Number(row.margin_percent)}%`}</td>
                                        <td className="p-2 text-right font-medium">{lkr(row.applied_rate)}</td>
                                        <td className="p-2">{row.source}{row.is_manual && row.user?.name ? ` (${row.user.name})` : ''}</td>
                                    </tr>
                                ))}
                                {status.history.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No rates fetched yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
