'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Play, RotateCcw, Loader2, RefreshCw, Send } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import type { User, SalaryDetails, PayrollRecord } from '@/lib/types';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { PayrollCalculationSnapshot } from '@/lib/types';

interface SalaryCalculation extends PayrollCalculationSnapshot {
    user_id: string;
    month: string;
    allowances_json?: any[];
    working_days: number;
    per_day_rate: number;
    is_prorated: boolean;
    join_date: string | null;
    days_worked: number;
}

interface ProcessEmployee extends User {
    salary?: SalaryDetails;
    payroll?: PayrollRecord;
    calculation?: SalaryCalculation | null;
}

function apitBandLabel(taxableIncome: number): string {
    if (taxableIncome <= 150_000) return 'No tax (≤ 150,000)';
    if (taxableIncome <= 233_333) return '6% − 9,000 (Band 2)';
    if (taxableIncome <= 275_000) return '18% − 37,000 (Band 3)';
    if (taxableIncome <= 316_667) return '24% − 53,500 (Band 4)';
    if (taxableIncome <= 358_333) return '30% − 72,500 (Band 5)';
    return '36% − 94,000 (Band 6)';
}

const supabase = createClient();

    // Compute default period dates from global config for a given month string
    async function computeDefaultPeriod(monthStr: string): Promise<{ start: string; end: string }> {
        const [y, m] = monthStr.split('-').map(Number);
        try {
            const res = await fetch('/api/admin/app-settings?key=payroll_period_config');
            const d = await res.json();
            const val = (d.value as any) ?? {};

            // Annual per-month overrides take priority
            const annual: Record<string, { start: string; end: string }> = val.annual ?? {};
            if (annual[monthStr]) return annual[monthStr];

            const startDay: number = val.period_start_day ?? 1;
            if (startDay <= 1) {
                const last = new Date(y, m, 0).getDate();
                return {
                    start: `${y}-${String(m).padStart(2, '0')}-01`,
                    end: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
                };
            }
            const prevMon = m === 1 ? 12 : m - 1;
            const prevYear = m === 1 ? y - 1 : y;
            const prevLast = new Date(prevYear, prevMon, 0).getDate();
            const s = Math.min(startDay, prevLast);
            const e = Math.min(startDay - 1, new Date(y, m, 0).getDate());
            return {
                start: `${prevYear}-${String(prevMon).padStart(2, '0')}-${String(s).padStart(2, '0')}`,
                end: `${y}-${String(m).padStart(2, '0')}-${String(e).padStart(2, '0')}`,
            };
        } catch {
            const last = new Date(y, m, 0).getDate();
            return {
                start: `${y}-${String(m).padStart(2, '0')}-01`,
                end: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
            };
        }
    }

// Build a list of month options spanning prev year through next month
function buildMonthOptions(): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    // Start from Jan of previous year, end at next month
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const cur = new Date(start);
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const value = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = cur.toLocaleString('en', { month: 'long', year: 'numeric' });
        options.push({ value, label });
        cur.setMonth(cur.getMonth() + 1);
    }
    return options;
}

const MONTH_OPTIONS = buildMonthOptions();

export function PayrollRun() {
    const today = new Date().toISOString().slice(0, 7);
    const [month, setMonth] = useState<string>(today);
    const [periodStart, setPeriodStart] = useState<string>('');
    const [periodEnd, setPeriodEnd] = useState<string>('');
    const [annualPeriods, setAnnualPeriods] = useState<Record<string, { start: string; end: string }>>({});
    const [employees, setEmployees] = useState<ProcessEmployee[]>([]);
    const [missingSalaryEmployees, setMissingSalaryEmployees] = useState<ProcessEmployee[]>([]);
    const [totalServiceCharge, setTotalServiceCharge] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [unprocessing, setUnprocessing] = useState<string | null>(null);
    const [releasing, setReleasing] = useState<string | null>(null);
    const { toast } = useToast();

    // Load annual pay period config once on mount
    useEffect(() => {
        fetch('/api/admin/app-settings?key=payroll_period_config')
            .then(r => r.json())
            .then(d => setAnnualPeriods(((d.value as any)?.annual) ?? {}))
            .catch(() => {});
    }, []);

    // When month or annual config changes, auto-load the period dates
    useEffect(() => {
        if (annualPeriods[month]) {
            setPeriodStart(annualPeriods[month].start);
            setPeriodEnd(annualPeriods[month].end);
        } else {
            computeDefaultPeriod(month).then(({ start, end }) => {
                setPeriodStart(start);
                setPeriodEnd(end);
            });
        }
    }, [month, annualPeriods]);

    const fetchData = useCallback(async () => {
        if (!periodStart || !periodEnd) return;
        setLoading(true);
        try {
            const [{ data: usersData, error: usersError }, settingsRes, payrollRes, ordersRes] = await Promise.all([
                supabase.from('users').select('*').order('name'),
                fetch('/api/hrms/payroll/settings'),
                fetch(`/api/hrms/payroll/process?month=${month}`),
                supabase
                    .from('orders')
                    .select('bill_breakdown')
                    .eq('status', 'closed')
                    .gte('created_at', `${periodStart}T00:00:00`)
                    .lte('created_at', `${periodEnd}T23:59:59`),
            ]);
            if (usersError) throw usersError;

            // Auto-fill total service charge from closed orders in the period
            const scTotal = (ordersRes.data ?? []).reduce(
                (sum: number, o: any) => sum + (o.bill_breakdown?.service_charge_total ?? 0), 0
            );
            setTotalServiceCharge(scTotal > 0 ? scTotal.toFixed(2) : '');

            const settings: SalaryDetails[] = (await settingsRes.json()).salaryDetails ?? [];
            const payrolls: PayrollRecord[] = (await payrollRes.json()).payrollRecords ?? [];

            // Only show employees who have a join_date AND have already joined by the period end
            const eligibleUsers = (usersData ?? []).filter((user: User) =>
                user.join_date && user.join_date.slice(0, 10) <= periodEnd
            );

            const calcs = await Promise.all(
                eligibleUsers.map((user: User) =>
                    fetch(`/api/hrms/payroll/calculate?userId=${user.id}&month=${month}&periodStart=${periodStart}&periodEnd=${periodEnd}`)
                        .then(r => r.json())
                        .then(d => ({ userId: user.id, calc: (d.calculation ?? null) as SalaryCalculation | null }))
                        .catch(() => ({ userId: user.id, calc: null }))
                )
            );
            const calcMap = Object.fromEntries(calcs.map(c => [c.userId, c.calc]));

            const processed = eligibleUsers.map(user => ({
                ...user,
                salary: settings.find(s => s.user_id === user.id),
                payroll: payrolls.find(p => p.user_id === user.id),
                calculation: calcMap[user.id] ?? null,
            }));

            // Employees with no basic salary configured can't be run through
            // payroll — keep them out of the main table and call them out
            // separately so it's obvious who still needs Salary Configuration.
            setEmployees(processed.filter(emp => (emp.salary?.basic_salary ?? 0) > 0));
            setMissingSalaryEmployees(processed.filter(emp => !((emp.salary?.basic_salary ?? 0) > 0)));
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load payroll data.' });
        } finally {
            setLoading(false);
        }
    }, [month, periodStart, periodEnd]);

    useEffect(() => {
        if (periodStart && periodEnd) fetchData();
    }, [fetchData]);

    const handleUnprocess = async (employee: ProcessEmployee) => {
        setUnprocessing(employee.id);
        try {
            const res = await fetch(`/api/hrms/payroll/process?userId=${employee.id}&month=${month}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');
            toast({ title: 'Unprocessed', description: `Payroll reset for ${employee.name}.` });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setUnprocessing(null);
        }
    };

    const handleRelease = async (employee: ProcessEmployee) => {
        setReleasing(employee.id);
        try {
            const res = await fetch(`/api/hrms/payroll/process?userId=${employee.id}&month=${month}`, {
                method: 'PATCH',
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');
            toast({ title: 'Released', description: `Payslip released to ${employee.name}.` });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setReleasing(null);
        }
    };

    const handleProcess = async (employee: ProcessEmployee) => {
        setProcessing(employee.id);
        try {
            const calc = employee.calculation;
            const res = await fetch('/api/hrms/payroll/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: employee.id,
                    month,
                    basic_salary: calc?.basic_salary ?? employee.salary?.basic_salary ?? 0,
                    allowances: calc?.allowances ?? employee.salary?.fixed_allowances ?? 0,
                    joining_deduction: calc?.joining_deduction ?? 0,
                    leave_deduction: calc?.leave_deduction ?? 0,
                    deductions: 0,
                    tax: calc?.apit_tax ?? 0,
                    ot_hours: calc?.ot_hours ?? 0,
                    ot_pay: calc?.ot_pay ?? 0,
                    service_charge: scShareMap[employee.id] ?? 0,
                    status: 'processed',
                    calculation_snapshot: calc ? { ...calc, service_charge: scShareMap[employee.id] ?? 0 } : null,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error ?? data.details ?? 'Unknown error');
            toast({ title: 'Processed', description: `Payroll processed for ${employee.name}.` });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payroll Error', description: error.message });
        } finally {
            setProcessing(null);
        }
    };

    const fmt = (n: number) =>
        n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Service charge distribution
    const scTotal = parseFloat(totalServiceCharge) || 0;
    const eligibleForSC = employees.filter(e => e.service_charge_applicable === true && (e.service_charge_rate ?? 0) > 0);
    const totalRates = eligibleForSC.reduce((s, e) => s + (e.service_charge_rate ?? 0), 0);
    const scShareMap: Record<string, number> = {};
    if (scTotal > 0 && totalRates > 0) {
        eligibleForSC.forEach(e => {
            scShareMap[e.id] = ((e.service_charge_rate ?? 0) / totalRates) * scTotal;
        });
    }

    // Totals for the summary bar
    const totalAPIT = employees.reduce((sum, emp) => sum + (emp.calculation?.apit_tax ?? 0), 0);
    const totalEPFEmployee = employees.reduce((sum, emp) => sum + (emp.calculation?.epf_employee_8 ?? 0), 0);
    const totalEPFEmployer = employees.reduce((sum, emp) => sum + (emp.calculation?.epf_employer_12 ?? 0), 0);
    const totalETF = employees.reduce((sum, emp) => sum + (emp.calculation?.etf_employer_3 ?? 0), 0);
    const totalNetSalary = employees.reduce((sum, emp) => sum + (emp.calculation?.net_salary ?? 0) + (scShareMap[emp.id] ?? 0), 0);

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <CardTitle>Run Payroll</CardTitle>
                            <CardDescription>
                                APIT is auto-calculated per IRD Tax Table No. 01 (w.e.f. 01.04.2025).
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-end gap-3 shrink-0">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground font-medium">Month</span>
                                <Select value={month} onValueChange={setMonth}>
                                    <SelectTrigger className="w-44 h-8 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTH_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground font-medium">Period From</span>
                                <Input
                                    type="date"
                                    value={periodStart}
                                    onChange={(e) => setPeriodStart(e.target.value)}
                                    className="w-36 h-8 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground font-medium">Period To</span>
                                <Input
                                    type="date"
                                    value={periodEnd}
                                    onChange={(e) => setPeriodEnd(e.target.value)}
                                    className="w-36 h-8 text-sm"
                                />
                            </div>
                            <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="h-8">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-sm">Calculating salaries for {month}…</span>
                        </div>
                    ) : (
                        <>
                            {/* Service charge input */}
                            <div className="flex items-end gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200">
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-amber-800 mb-1">Total Monthly Service Charge (LKR)</p>
                                    <p className="text-[11px] text-amber-700 mb-1.5">
                                        Auto-fetched from closed orders in pay period
                                        {periodStart && periodEnd ? ` ${periodStart} → ${periodEnd}` : ''}.
                                        Edit if needed.
                                    </p>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        placeholder="0.00"
                                        value={totalServiceCharge}
                                        onChange={e => setTotalServiceCharge(e.target.value)}
                                        className="h-8 text-sm max-w-xs bg-white"
                                    />
                                </div>
                                {scTotal > 0 && totalRates > 0 && (
                                    <div className="text-xs text-amber-800 space-y-0.5 shrink-0">
                                        <p className="font-semibold">Distribution</p>
                                        <p>{eligibleForSC.length} eligible · {totalRates} total points</p>
                                    </div>
                                )}
                            </div>

                            {/* Summary bar */}
                            {employees.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Total APIT</p>
                                        <p className="font-semibold text-orange-600">LKR {fmt(totalAPIT)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">EPF (Emp 8%)</p>
                                        <p className="font-semibold">LKR {fmt(totalEPFEmployee)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">EPF (Empl 12%)</p>
                                        <p className="font-semibold">LKR {fmt(totalEPFEmployer)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">ETF (3%)</p>
                                        <p className="font-semibold">LKR {fmt(totalETF)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Total Net Payable</p>
                                        <p className="font-semibold text-green-600">LKR {fmt(totalNetSalary)}</p>
                                    </div>
                                </div>
                            )}

                            {missingSalaryEmployees.length > 0 && (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                    <p className="font-semibold">
                                        {missingSalaryEmployees.length} employee{missingSalaryEmployees.length !== 1 ? 's' : ''} missing a basic salary — excluded from payroll below until set in Salary Configuration:
                                    </p>
                                    <p className="mt-1">
                                        {missingSalaryEmployees.map(e => e.name).join(', ')}
                                    </p>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Basic Salary</TableHead>
                                            <TableHead>No-Pay Days</TableHead>
                                            <TableHead>Deductions</TableHead>
                                            <TableHead>OT</TableHead>
                                            <TableHead>Gross</TableHead>
                                            <TableHead>EPF (8%) / Employer</TableHead>
                                            <TableHead>APIT Tax</TableHead>
                                            <TableHead>Svc Charge</TableHead>
                                            <TableHead>Net Salary</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees.map(emp => {
                                            const isProcessed = !!emp.payroll;
                                            const isReleased = !!(emp.payroll?.released_at);
                                            // For processed rows use the frozen snapshot so rate/salary changes don't alter history
                                            const snap = emp.payroll?.calculation_snapshot ?? null;
                                            const calc = isProcessed && snap
                                                ? { ...snap, user_id: emp.id, month } as SalaryCalculation
                                                : emp.calculation;
                                            const sal = emp.salary;

                                            const basic = calc?.basic_salary ?? sal?.basic_salary ?? 0;
                                            const allowances = calc?.allowances ?? sal?.fixed_allowances ?? 0;
                                            const gross = calc?.gross_salary ?? (basic + allowances);
                                            const otHours = calc?.ot_hours ?? (isProcessed ? emp.payroll?.ot_hours : 0) ?? 0;
                                            const otPay = calc?.ot_pay ?? (isProcessed ? emp.payroll?.ot_pay : 0) ?? 0;
                                            const epfEmp = calc?.epf_employee_8 ?? basic * 0.08;
                                            const epfEmpl = calc?.epf_employer_12 ?? basic * 0.12;
                                            const etf = calc?.etf_employer_3 ?? basic * 0.03;
                                            const net = calc?.net_salary ?? (gross - epfEmp);
                                            // Only show salary data when salary has actually been configured (basic > 0)
                                            const hasSalary = !!(sal) || basic > 0;

                                            return (
                                                <TableRow key={emp.id}>
                                                    {/* Employee */}
                                                    <TableCell>
                                                        <div className="font-medium">{emp.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {emp.job_title ?? emp.role}{emp.department ? ` · ${emp.department}` : ''}
                                                        </div>
                                                    </TableCell>

                                                    {/* Basic Salary */}
                                                    <TableCell>
                                                        {hasSalary ? (
                                                            <>
                                                                <div className="text-sm font-medium">LKR {fmt(basic)}</div>
                                                                {calc?.is_prorated ? (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="text-xs text-amber-600 font-medium cursor-help">
                                                                                Prorated · {calc.days_worked}/{calc.working_days} days
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            Joined {calc.join_date} — salary starts from join date
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                ) : calc ? (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {calc.working_days} days · LKR {fmt(calc.per_day_rate)}/day
                                                                    </div>
                                                                ) : null}
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">Not configured</span>
                                                        )}
                                                    </TableCell>

                                                    {/* No-Pay Days */}
                                                    <TableCell>
                                                        {calc && calc.nopay_days > 0 ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-sm font-semibold text-red-600 cursor-help">
                                                                        {calc.nopay_days} {calc.nopay_days === 1 ? 'day' : 'days'}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>No-pay leave + absent attendance</TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Deductions */}
                                                    <TableCell>
                                                        {calc && calc.total_deduction > 0 ? (
                                                            <div className="space-y-0.5">
                                                                {calc.joining_deduction > 0 && (
                                                                    <div className="text-xs font-semibold text-amber-600">
                                                                        − LKR {fmt(calc.joining_deduction)}
                                                                        <span className="font-normal text-muted-foreground ml-1">(joining)</span>
                                                                    </div>
                                                                )}
                                                                {calc.leave_deduction > 0 && (
                                                                    <div className="text-xs font-semibold text-red-600">
                                                                        − LKR {fmt(calc.leave_deduction)}
                                                                        <span className="font-normal text-muted-foreground ml-1">(no-pay)</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* OT */}
                                                    <TableCell>
                                                        {otHours > 0 ? (
                                                            <div>
                                                                <div className="text-sm font-semibold text-blue-600">+ LKR {fmt(otPay)}</div>
                                                                <div className="text-xs text-muted-foreground">{otHours}h approved</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Gross */}
                                                    <TableCell>
                                                        {hasSalary ? (
                                                            <>
                                                                <div className="text-sm">LKR {fmt(gross)}</div>
                                                                {allowances > 0 && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        incl. LKR {fmt(allowances)} allowances
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* EPF */}
                                                    <TableCell>
                                                        {hasSalary ? (
                                                            <>
                                                                <div className="text-xs">Emp: LKR {fmt(epfEmp)}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    Empl: LKR {fmt(epfEmpl + etf)}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* APIT Tax */}
                                                    <TableCell>
                                                        {calc ? (
                                                            calc.apit_tax > 0 ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="cursor-help">
                                                                            <div className="text-sm font-semibold text-orange-600">
                                                                                LKR {fmt(calc.apit_tax)}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {apitBandLabel(calc.taxable_income)}
                                                                            </div>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="text-xs space-y-1 max-w-[220px]">
                                                                        <p className="font-semibold">APIT Breakdown</p>
                                                                        <p>Taxable income: LKR {fmt(calc.taxable_income)}</p>
                                                                        <p className="text-muted-foreground">= (Eff. basic + allowances) − EPF 8%</p>
                                                                        <p>Band: {apitBandLabel(calc.taxable_income)}</p>
                                                                        <p className="font-semibold">Tax: LKR {fmt(calc.apit_tax)}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Nil</span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Service Charge */}
                                                    <TableCell>
                                                        {emp.service_charge_applicable === true ? (
                                                            scShareMap[emp.id] != null ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="cursor-help">
                                                                            <div className="text-sm font-semibold text-amber-700">+ LKR {fmt(scShareMap[emp.id])}</div>
                                                                            <div className="text-xs text-muted-foreground">{emp.service_charge_rate} pts</div>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="text-xs space-y-1 max-w-[200px]">
                                                                        <p className="font-semibold">Service Charge Share</p>
                                                                        <p>{emp.service_charge_rate} / {totalRates} pts × LKR {fmt(scTotal)}</p>
                                                                        <p className="font-semibold">= LKR {fmt(scShareMap[emp.id])}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">{emp.service_charge_rate ? 'Enter total above' : 'No rate set'}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Net Salary */}
                                                    <TableCell className="font-bold">
                                                        {hasSalary ? (
                                                            isProcessed
                                                                ? `LKR ${fmt(emp.payroll!.net_salary)}`
                                                                : `LKR ${fmt(net + (scShareMap[emp.id] ?? 0))}`
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">Not configured</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Status */}
                                                    <TableCell>
                                                        {isReleased ? (
                                                            <Badge className="bg-blue-500">Released</Badge>
                                                        ) : isProcessed ? (
                                                            <Badge className="bg-amber-500">Processed</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">Draft</Badge>
                                                        )}
                                                    </TableCell>

                                                    {/* Action */}
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            {!isProcessed && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleProcess(emp)}
                                                                    disabled={processing === emp.id || !hasSalary}
                                                                    title={!hasSalary ? 'Configure salary first' : undefined}
                                                                >
                                                                    {processing === emp.id
                                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                        : <><Play className="h-4 w-4 mr-1" />Process</>
                                                                    }
                                                                </Button>
                                                            )}
                                                            {isProcessed && !isReleased && (
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-blue-600 hover:bg-blue-700"
                                                                    onClick={() => handleRelease(emp)}
                                                                    disabled={releasing === emp.id}
                                                                >
                                                                    {releasing === emp.id
                                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                        : <><Send className="h-4 w-4 mr-1" />Release</>
                                                                    }
                                                                </Button>
                                                            )}
                                                            {isProcessed && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleUnprocess(emp)}
                                                                    disabled={unprocessing === emp.id}
                                                                >
                                                                    {unprocessing === emp.id
                                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                        : <RotateCcw className="h-4 w-4" />
                                                                    }
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {employees.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                                    No employees found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
