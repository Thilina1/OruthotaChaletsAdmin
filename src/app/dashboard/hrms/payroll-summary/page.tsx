'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import * as XLSX from 'xlsx';
import type { PayrollRecord, PayrollCalculationSnapshot } from "@/lib/types";

type EnrichedRecord = PayrollRecord & {
    users?: { name: string; email: string };
    snap?: PayrollCalculationSnapshot | null;
};

export default function PayrollSummaryPage() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [records, setRecords] = useState<EnrichedRecord[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/hrms/payroll/process?month=${month}`);
            const data = await res.json();
            const raw: EnrichedRecord[] = (data.payrollRecords ?? []).map((r: any) => ({
                ...r,
                snap: r.calculation_snapshot ?? null,
            }));
            setRecords(raw);
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fmt = (n: number) =>
        n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Aggregate totals
    const totals = records.reduce((acc, r) => {
        const snap = r.snap;
        return {
            gross: acc.gross + (snap?.gross_salary ?? r.gross_salary),
            epfEmp: acc.epfEmp + (snap?.epf_employee_8 ?? r.epf_employee_8),
            epfEmpl: acc.epfEmpl + (snap?.epf_employer_12 ?? r.epf_employer_12),
            etf: acc.etf + (snap?.etf_employer_3 ?? r.etf_employer_3),
            apit: acc.apit + (snap?.apit_tax ?? r.tax),
            serviceCharge: acc.serviceCharge + (snap?.service_charge ?? r.service_charge ?? 0),
            net: acc.net + (snap?.net_salary ?? r.net_salary),
            deductions: acc.deductions + (snap?.total_deduction ?? r.deductions),
        };
    }, { gross: 0, epfEmp: 0, epfEmpl: 0, etf: 0, apit: 0, serviceCharge: 0, net: 0, deductions: 0 });

    const handleExport = () => {
        const monthLabel = new Date(month + '-01').toLocaleString('en-LK', { month: 'long', year: 'numeric' });

        const rows = records.map(r => {
            const snap = r.snap;
            const basic = snap?.basic_salary ?? r.basic_salary;
            const allowances = snap?.allowances ?? r.allowances;
            const gross = snap?.gross_salary ?? r.gross_salary;
            const nopayDays = snap?.nopay_days ?? 0;
            const leaveDeduction = snap?.leave_deduction ?? 0;
            const joiningDeduction = snap?.joining_deduction ?? 0;
            const totalDeduction = snap?.total_deduction ?? r.deductions;
            const effectiveBasic = snap?.effective_basic ?? (basic - joiningDeduction - leaveDeduction);
            const epfEmployee = snap?.epf_employee_8 ?? r.epf_employee_8;
            const epfEmployer = snap?.epf_employer_12 ?? r.epf_employer_12;
            const etf = snap?.etf_employer_3 ?? r.etf_employer_3;
            const taxableIncome = snap?.taxable_income ?? 0;
            const apit = snap?.apit_tax ?? r.tax;
            const serviceCharge = snap?.service_charge ?? r.service_charge ?? 0;
            const net = snap?.net_salary ?? r.net_salary;

            return {
                'Employee Name': r.users?.name ?? '',
                'Email': r.users?.email ?? '',
                'Month': month,
                'Basic Salary': basic,
                'Allowances': allowances,
                'Gross Salary': gross,
                'No-Pay Days': nopayDays,
                'Leave Deduction (LKR)': leaveDeduction,
                'Joining Deduction (LKR)': joiningDeduction,
                'Total Deductions (LKR)': totalDeduction,
                'Effective Basic (LKR)': effectiveBasic,
                'EPF Employee 8% (LKR)': epfEmployee,
                'EPF Employer 12% (LKR)': epfEmployer,
                'ETF Employer 3% (LKR)': etf,
                'Taxable Income (LKR)': taxableIncome,
                'APIT Tax (LKR)': apit,
                'Service Charge (LKR)': serviceCharge,
                'Net Salary (LKR)': net,
                'Status': r.released_at ? 'Released' : 'Processed',
            };
        });

        // Totals row
        rows.push({
            'Employee Name': `TOTAL (${records.length} employees)`,
            'Email': '',
            'Month': month,
            'Basic Salary': 0,
            'Allowances': 0,
            'Gross Salary': totals.gross,
            'No-Pay Days': 0,
            'Leave Deduction (LKR)': 0,
            'Joining Deduction (LKR)': 0,
            'Total Deductions (LKR)': totals.deductions,
            'Effective Basic (LKR)': 0,
            'EPF Employee 8% (LKR)': totals.epfEmp,
            'EPF Employer 12% (LKR)': totals.epfEmpl,
            'ETF Employer 3% (LKR)': totals.etf,
            'Taxable Income (LKR)': 0,
            'APIT Tax (LKR)': totals.apit,
            'Service Charge (LKR)': totals.serviceCharge,
            'Net Salary (LKR)': totals.net,
            'Status': '',
        });

        const ws = XLSX.utils.json_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
            { wch: 24 }, { wch: 30 }, { wch: 12 },
            { wch: 14 }, { wch: 14 }, { wch: 14 },
            { wch: 12 }, { wch: 20 }, { wch: 22 },
            { wch: 22 }, { wch: 22 }, { wch: 22 },
            { wch: 22 }, { wch: 20 }, { wch: 22 },
            { wch: 16 }, { wch: 18 }, { wch: 12 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, monthLabel.slice(0, 31));
        XLSX.writeFile(wb, `Payroll_${month}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Payroll Summary</h1>
                    <p className="text-muted-foreground">Processed payroll figures for the selected month.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Month:</span>
                    <Input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="w-40"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={records.length === 0}
                    >
                        <Download className="h-4 w-4 mr-1.5" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                {[
                    { label: 'Employees', value: records.length.toString(), plain: true },
                    { label: 'Total Gross', value: `LKR ${fmt(totals.gross)}` },
                    { label: 'EPF Employee', value: `LKR ${fmt(totals.epfEmp)}`, sub: '8% of eff. basic' },
                    { label: 'EPF + ETF Employer', value: `LKR ${fmt(totals.epfEmpl + totals.etf)}`, sub: '12% + 3%' },
                    { label: 'Total APIT', value: `LKR ${fmt(totals.apit)}`, highlight: true },
                    { label: 'Total Service Charge', value: `LKR ${fmt(totals.serviceCharge)}`, amber: true },
                    { label: 'Total Net Payable', value: `LKR ${fmt(totals.net)}`, green: true },
                ].map(card => (
                    <Card key={card.label}>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground">{card.label}</p>
                            <p className={`text-lg font-bold mt-1 ${card.green ? 'text-green-600' : card.highlight ? 'text-orange-600' : (card as any).amber ? 'text-amber-700' : ''}`}>
                                {card.plain ? <span className="text-3xl">{card.value}</span> : card.value}
                            </p>
                            {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* No-pay / deductions summary */}
            {totals.deductions > 0 && (
                <Card>
                    <CardContent className="py-3 text-sm">
                        Total deductions (no-pay + joining): <span className="font-semibold text-red-600">LKR {fmt(totals.deductions)}</span>
                    </CardContent>
                </Card>
            )}

            {/* Per-employee table */}
            <Card>
                <CardHeader>
                    <CardTitle>Per-Employee Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : records.length === 0 ? (
                        <p className="text-center py-10 text-muted-foreground">No processed payroll records for {month}.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Basic</TableHead>
                                        <TableHead>Gross</TableHead>
                                        <TableHead>No-Pay</TableHead>
                                        <TableHead>EPF (Emp 8%)</TableHead>
                                        <TableHead>EPF+ETF (Empl)</TableHead>
                                        <TableHead>APIT Tax</TableHead>
                                        <TableHead>Svc Charge</TableHead>
                                        <TableHead className="font-bold">Net Salary</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map(r => {
                                        const snap = r.snap;
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell>
                                                    <div className="font-medium">{r.users?.name ?? '—'}</div>
                                                    <div className="text-xs text-muted-foreground">{r.users?.email}</div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    LKR {fmt(snap?.basic_salary ?? r.basic_salary)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    LKR {fmt(snap?.gross_salary ?? r.gross_salary)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {(snap?.nopay_days ?? 0) > 0 ? (
                                                        <span className="text-red-600 font-medium">
                                                            {snap!.nopay_days} day{snap!.nopay_days !== 1 ? 's' : ''}
                                                            <span className="block text-xs font-normal">
                                                                − LKR {fmt(snap!.leave_deduction)}
                                                            </span>
                                                        </span>
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    LKR {fmt(snap?.epf_employee_8 ?? r.epf_employee_8)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    LKR {fmt((snap?.epf_employer_12 ?? r.epf_employer_12) + (snap?.etf_employer_3 ?? r.etf_employer_3))}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {(snap?.apit_tax ?? r.tax) > 0
                                                        ? <span className="text-orange-600 font-medium">LKR {fmt(snap?.apit_tax ?? r.tax)}</span>
                                                        : <span className="text-muted-foreground">Nil</span>}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {(snap?.service_charge ?? r.service_charge ?? 0) > 0
                                                        ? <span className="text-amber-700 font-medium">LKR {fmt(snap?.service_charge ?? r.service_charge ?? 0)}</span>
                                                        : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="font-bold">
                                                    LKR {fmt(snap?.net_salary ?? r.net_salary)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="default" className="bg-green-500">Processed</Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}

                                    {/* Totals row */}
                                    <TableRow className="font-semibold bg-muted/50">
                                        <TableCell>Total ({records.length} employees)</TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell>LKR {fmt(totals.gross)}</TableCell>
                                        <TableCell className="text-red-600">− LKR {fmt(totals.deductions)}</TableCell>
                                        <TableCell>LKR {fmt(totals.epfEmp)}</TableCell>
                                        <TableCell>LKR {fmt(totals.epfEmpl + totals.etf)}</TableCell>
                                        <TableCell className="text-orange-600">LKR {fmt(totals.apit)}</TableCell>
                                        <TableCell className="text-amber-700">LKR {fmt(totals.serviceCharge)}</TableCell>
                                        <TableCell className="text-green-600">LKR {fmt(totals.net)}</TableCell>
                                        <TableCell>—</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
