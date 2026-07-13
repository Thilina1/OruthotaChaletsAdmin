'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalarySettings } from '@/components/dashboard/hrms/payroll/salary-settings';
import { PayrollRun } from '@/components/dashboard/hrms/payroll/payroll-run';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CalendarRange, Save, RefreshCw } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function computePeriodsFromStartDay(startDay: number, year: number): Record<string, { start: string; end: string }> {
    const result: Record<string, { start: string; end: string }> = {};
    for (let m = 1; m <= 12; m++) {
        const mk = `${year}-${String(m).padStart(2, '0')}`;
        if (startDay <= 1) {
            const last = new Date(year, m, 0).getDate();
            result[mk] = {
                start: `${year}-${String(m).padStart(2, '0')}-01`,
                end: `${year}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
            };
        } else {
            const prevM = m === 1 ? 12 : m - 1;
            const prevY = m === 1 ? year - 1 : year;
            const prevLast = new Date(prevY, prevM, 0).getDate();
            const s = Math.min(startDay, prevLast);
            const e = Math.min(startDay - 1, new Date(year, m, 0).getDate());
            result[mk] = {
                start: `${prevY}-${String(prevM).padStart(2, '0')}-${String(s).padStart(2, '0')}`,
                end: `${year}-${String(m).padStart(2, '0')}-${String(e).padStart(2, '0')}`,
            };
        }
    }
    return result;
}

function PayPeriodSettings() {
    const { toast } = useToast();
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [startDay, setStartDay] = useState<number>(1);
    const [periods, setPeriods] = useState<Record<string, { start: string; end: string }>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const months = Array.from({ length: 12 }, (_, i) =>
        `${year}-${String(i + 1).padStart(2, '0')}`
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/app-settings?key=payroll_period_config');
            const d = await res.json();
            const val = (d.value as any) ?? {};
            const sd: number = val.period_start_day ?? 1;
            setStartDay(sd);
            const stored: Record<string, { start: string; end: string }> = val.annual ?? {};
            const defaults = computePeriodsFromStartDay(sd, year);
            const merged: Record<string, { start: string; end: string }> = {};
            months.forEach(mk => { merged[mk] = stored[mk] ?? defaults[mk]; });
            setPeriods(merged);
        } catch {
            const defaults = computePeriodsFromStartDay(1, year);
            const merged: Record<string, { start: string; end: string }> = {};
            months.forEach(mk => { merged[mk] = defaults[mk]; });
            setPeriods(merged);
        } finally {
            setLoading(false);
        }
    }, [year]);

    useEffect(() => { load(); }, [load]);

    const autoFill = () => {
        setPeriods(computePeriodsFromStartDay(Math.min(28, Math.max(1, startDay)), year));
    };

    const updatePeriod = (mk: string, field: 'start' | 'end', value: string) => {
        setPeriods(prev => ({ ...prev, [mk]: { ...prev[mk], [field]: value } }));
    };

    const save = async () => {
        setSaving(true);
        try {
            const existingRes = await fetch('/api/admin/app-settings?key=payroll_period_config');
            const existingD = await existingRes.json();
            const existing = (existingD.value as any) ?? {};
            const res = await fetch('/api/admin/app-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'payroll_period_config',
                    value: {
                        period_start_day: startDay,
                        annual: { ...(existing.annual ?? {}), ...periods },
                    },
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Saved', description: `Pay periods for ${year} saved.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CalendarRange className="h-5 w-5 text-primary" />
                    <div>
                        <CardTitle>Pay Period Configuration</CardTitle>
                        <CardDescription>
                            Set the exact pay period start and end dates for each month of the year.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-1">
                                <Label>Year</Label>
                                <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                                    <SelectTrigger className="w-28">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="start-day">Auto-fill from start day (1–28)</Label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        id="start-day"
                                        type="number"
                                        min={1}
                                        max={28}
                                        value={startDay}
                                        onChange={e => setStartDay(Number(e.target.value))}
                                        className="w-20"
                                    />
                                    <Button size="sm" variant="outline" onClick={autoFill}>
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        Auto-fill
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-40">Month</TableHead>
                                        <TableHead>Period Start</TableHead>
                                        <TableHead>Period End</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {months.map((mk, i) => (
                                        <TableRow key={mk}>
                                            <TableCell className="font-medium">{MONTH_NAMES[i]} {year}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="date"
                                                    value={periods[mk]?.start ?? ''}
                                                    onChange={e => updatePeriod(mk, 'start', e.target.value)}
                                                    className="w-40 h-8 text-sm"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="date"
                                                    value={periods[mk]?.end ?? ''}
                                                    onChange={e => updatePeriod(mk, 'end', e.target.value)}
                                                    className="w-40 h-8 text-sm"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <Button onClick={save} disabled={saving} className="w-fit">
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving…' : `Save ${year} Pay Periods`}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default function PayrollPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Payroll Management</h1>
                <p className="text-muted-foreground">Manage employee salaries, EPF/ETF contributions, and process monthly payroll.</p>
            </div>

            <Tabs defaultValue="run-payroll">
                <TabsList>
                    <TabsTrigger value="run-payroll">Run Payroll</TabsTrigger>
                    <TabsTrigger value="settings">Salary Configuration</TabsTrigger>
                    <TabsTrigger value="pay-period">Pay Period</TabsTrigger>
                </TabsList>

                <TabsContent value="run-payroll" className="space-y-4">
                    <PayrollRun />
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <SalarySettings />
                </TabsContent>

                <TabsContent value="pay-period" className="space-y-4">
                    <PayPeriodSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
