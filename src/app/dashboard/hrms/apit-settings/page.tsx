'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Info } from "lucide-react";
import type { APItBand } from "@/lib/types";

type EditableBand = APItBand & { saving?: boolean };

export default function APItSettingsPage() {
    const [bands, setBands] = useState<EditableBand[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        fetch('/api/hrms/apit-settings')
            .then(r => r.json())
            .then(d => setBands(d.bands ?? []))
            .finally(() => setLoading(false));
    }, []);

    const update = (id: string, field: keyof APItBand, value: string) => {
        setBands(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const save = async (band: EditableBand) => {
        setBands(prev => prev.map(b => b.id === band.id ? { ...b, saving: true } : b));
        try {
            const res = await fetch('/api/hrms/apit-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: band.id,
                    band_label: band.band_label,
                    min_income: band.min_income,
                    max_income: band.max_income,
                    rate: band.rate,
                    deduction: band.deduction,
                    sort_order: band.sort_order,
                    effective_from: band.effective_from,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error ?? 'Save failed');
            toast({ title: 'Saved', description: `Band "${band.band_label}" updated.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setBands(prev => prev.map(b => b.id === band.id ? { ...b, saving: false } : b));
        }
    };

    const fmt = (n: number | null) =>
        n === null ? '∞' : n.toLocaleString('en-LK', { maximumFractionDigits: 0 });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">APIT Tax Bands</h1>
                <p className="text-muted-foreground">
                    Configure Sri Lanka APIT (formerly PAYE) tax bands per IRD circular. Changes apply to future payroll calculations only — processed records are unaffected.
                </p>
            </div>

            <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
                <CardContent className="flex gap-3 py-4 text-sm">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-blue-800 dark:text-blue-300 space-y-1">
                        <p className="font-medium">Formula: Tax = (Monthly Taxable Income × Rate) − Deduction</p>
                        <p>Taxable income = (Effective Basic + Allowances) − EPF employee 8%</p>
                        <p>Personal relief of Rs. 150,000/month is embedded in the deduction constants.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tax Bands</CardTitle>
                    <CardDescription>
                        Edit the Rate (%) and Deduction amount for each band. Effective from date is for reference only.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Band Label</TableHead>
                                    <TableHead>Min Income (LKR)</TableHead>
                                    <TableHead>Max Income (LKR)</TableHead>
                                    <TableHead>Rate (%)</TableHead>
                                    <TableHead>Deduction (LKR)</TableHead>
                                    <TableHead>Effective From</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bands.map(band => (
                                    <TableRow key={band.id}>
                                        <TableCell>
                                            <Input
                                                className="h-8 text-sm w-44"
                                                value={band.band_label}
                                                onChange={e => update(band.id, 'band_label', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                className="h-8 text-sm w-32"
                                                value={band.min_income}
                                                onChange={e => update(band.id, 'min_income', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                className="h-8 text-sm w-32"
                                                placeholder="∞ (no limit)"
                                                value={band.max_income ?? ''}
                                                onChange={e => update(band.id, 'max_income', e.target.value === '' ? null as any : e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={0.01}
                                                    className="h-8 text-sm w-20"
                                                    value={(Number(band.rate) * 100).toFixed(2)}
                                                    onChange={e => update(band.id, 'rate', String(Number(e.target.value) / 100))}
                                                />
                                                <span className="text-muted-foreground text-sm">%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="h-8 text-sm w-28"
                                                value={band.deduction}
                                                onChange={e => update(band.id, 'deduction', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="date"
                                                className="h-8 text-sm w-36"
                                                value={band.effective_from}
                                                onChange={e => update(band.id, 'effective_from', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                onClick={() => save(band)}
                                                disabled={band.saving}
                                            >
                                                {band.saving
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <><Save className="h-4 w-4 mr-1" />Save</>
                                                }
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Preview table */}
            {!loading && bands.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Preview</CardTitle>
                        <CardDescription>How the current bands read at a glance</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Monthly Taxable Income</TableHead>
                                    <TableHead>Tax Formula</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...bands].sort((a, b) => a.sort_order - b.sort_order).map(b => (
                                    <TableRow key={b.id}>
                                        <TableCell className="font-medium">
                                            {b.max_income === null
                                                ? `Above ${fmt(b.min_income - 1)}`
                                                : `${fmt(b.min_income)} – ${fmt(b.max_income)}`}
                                        </TableCell>
                                        <TableCell>
                                            {Number(b.rate) === 0
                                                ? 'No tax'
                                                : `(Salary × ${(Number(b.rate) * 100).toFixed(0)}%) − ${fmt(Number(b.deduction))}`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
