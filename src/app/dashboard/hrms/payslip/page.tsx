'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import type { PayrollRecord, PayrollCalculationSnapshot } from "@/lib/types";

type EnrichedRecord = PayrollRecord & {
    users?: { name: string; email: string; job_title?: string; department?: string };
    snap?: PayrollCalculationSnapshot | null;
};

function PayslipView({ record, onPrint }: { record: EnrichedRecord; onPrint: () => void }) {
    const snap = record.snap;
    const fmt = (n: number) => n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const monthLabel = new Date(record.month + '-01').toLocaleString('en-LK', { month: 'long', year: 'numeric' });

    const basic = snap?.basic_salary ?? record.basic_salary;
    const allowances = snap?.allowances ?? record.allowances;
    const gross = snap?.gross_salary ?? record.gross_salary;
    const joiningDeduction = snap?.joining_deduction ?? 0;
    const leaveDeduction = snap?.leave_deduction ?? 0;
    const effectiveBasic = snap?.effective_basic ?? (basic - joiningDeduction - leaveDeduction);
    const epfEmp = snap?.epf_employee_8 ?? record.epf_employee_8;
    const epfEmpl = snap?.epf_employer_12 ?? record.epf_employer_12;
    const etf = snap?.etf_employer_3 ?? record.etf_employer_3;
    const apit = snap?.apit_tax ?? record.tax;
    const nopayDays = snap?.nopay_days ?? 0;
    const workingDays = snap?.working_days ?? 0;
    const net = snap?.net_salary ?? record.net_salary;
    const taxableIncome = snap?.taxable_income ?? 0;
    const serviceCharge = snap?.service_charge ?? record.service_charge ?? 0;

    return (
        <div className="payslip-content bg-white rounded-lg border p-8 space-y-6 text-sm">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4">
                <div className="flex items-center gap-3">
                    <Building2 className="h-10 w-10 text-primary shrink-0" />
                    <div>
                        <h2 className="text-xl font-bold text-primary">Orutha Chalets</h2>
                        <p className="text-xs text-muted-foreground">Eco-Lanka Resorts (PVT) LTD</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold">PAYSLIP</p>
                    <p className="text-muted-foreground">{monthLabel}</p>
                    {record.released_at && (
                        <p className="text-xs text-muted-foreground">
                            Released: {new Date(record.released_at).toLocaleDateString('en-LK')}
                        </p>
                    )}
                </div>
            </div>

            {/* Employee details */}
            <div className="grid grid-cols-2 gap-4 py-2">
                <div className="space-y-1">
                    <p><span className="font-medium">Name:</span> {record.users?.name ?? '—'}</p>
                    <p><span className="font-medium">Designation:</span> {record.users?.job_title ?? '—'}</p>
                    <p><span className="font-medium">Department:</span> {record.users?.department ?? '—'}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p><span className="font-medium">Pay Period:</span> {monthLabel}</p>
                    {workingDays > 0 && <p><span className="font-medium">Working Days:</span> {workingDays}</p>}
                    {nopayDays > 0 && <p className="text-red-600"><span className="font-medium">No-Pay Days:</span> {nopayDays}</p>}
                </div>
            </div>

            {/* Earnings & Deductions side by side */}
            <div className="grid grid-cols-2 gap-6">
                {/* Earnings */}
                <div>
                    <h3 className="font-semibold text-base border-b pb-1 mb-2">Earnings</h3>
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span>Basic Salary</span>
                            <span className="font-medium">LKR {fmt(basic)}</span>
                        </div>
                        {allowances > 0 && (
                            <div className="flex justify-between">
                                <span>Allowances</span>
                                <span className="font-medium">LKR {fmt(allowances)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>Gross Salary</span>
                            <span>LKR {fmt(gross)}</span>
                        </div>
                        {serviceCharge > 0 && (
                            <div className="flex justify-between">
                                <span>Service Charge</span>
                                <span className="font-medium text-amber-700">LKR {fmt(serviceCharge)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Deductions */}
                <div>
                    <h3 className="font-semibold text-base border-b pb-1 mb-2">Deductions</h3>
                    <div className="space-y-1">
                        {joiningDeduction > 0 && (
                            <div className="flex justify-between">
                                <span>Joining Deduction</span>
                                <span className="text-amber-600">LKR {fmt(joiningDeduction)}</span>
                            </div>
                        )}
                        {leaveDeduction > 0 && (
                            <div className="flex justify-between">
                                <span>No-Pay Leave</span>
                                <span className="text-red-600">LKR {fmt(leaveDeduction)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>EPF (Employee 8%)</span>
                            <span>LKR {fmt(epfEmp)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>
                                APIT Tax
                                {taxableIncome > 0 && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                        on LKR {fmt(taxableIncome)}
                                    </span>
                                )}
                            </span>
                            <span className="text-orange-600">LKR {fmt(apit)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 font-semibold text-red-600">
                            <span>Total Deductions</span>
                            <span>LKR {fmt(joiningDeduction + leaveDeduction + epfEmp + apit)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Net Salary */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex justify-between items-center">
                <div>
                    <p className="text-sm text-muted-foreground">Net Salary Payable</p>
                    <p className="text-2xl font-bold text-primary">LKR {fmt(net)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>Effective Basic: LKR {fmt(effectiveBasic)}</p>
                    {serviceCharge > 0 && (
                        <p className="text-amber-700 font-medium">Service Charge: LKR {fmt(serviceCharge)}</p>
                    )}
                    <p>EPF Employer (12%): LKR {fmt(epfEmpl)}</p>
                    <p>ETF Employer (3%): LKR {fmt(etf)}</p>
                </div>
            </div>

            {/* Footer note */}
            <p className="text-xs text-muted-foreground text-center border-t pt-3">
                This is a computer-generated payslip. EPF/ETF contributions are remitted to the Department of Labour.
                APIT is deducted per IRD Tax Table No. 01 (w.e.f. 01.04.2025).
            </p>

            {/* Print-only action */}
            <div className="no-print flex justify-end">
                <Button onClick={onPrint} size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-1" /> Download / Print
                </Button>
            </div>
        </div>
    );
}

export default function PayslipPage() {
    const [records, setRecords] = useState<EnrichedRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/hrms/payroll/process')
            .then(r => r.json())
            .then(d => {
                const enriched: EnrichedRecord[] = (d.payrollRecords ?? []).map((r: any) => ({
                    ...r,
                    snap: r.calculation_snapshot ?? null,
                }));
                setRecords(enriched);
            })
            .finally(() => setLoading(false));
    }, []);

    const handlePrint = (record: EnrichedRecord) => {
        const monthLabel = new Date(record.month + '-01').toLocaleString('en-LK', { month: 'long', year: 'numeric' });
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const el = document.getElementById(`payslip-${record.id}`);
        const content = el?.innerHTML ?? '';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payslip – ${monthLabel}</title>
                <meta charset="utf-8" />
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: system-ui, sans-serif; font-size: 13px; color: #111; padding: 32px; }
                    h2 { font-size: 20px; font-weight: 700; color: #166534; }
                    h3 { font-size: 14px; font-weight: 600; }
                    .no-print { display: none !important; }
                    .grid { display: grid; }
                    .grid-cols-2 { grid-template-columns: 1fr 1fr; }
                    .gap-4 { gap: 16px; } .gap-6 { gap: 24px; }
                    .space-y-1 > * + * { margin-top: 4px; }
                    .space-y-6 > * + * { margin-top: 24px; }
                    .flex { display: flex; }
                    .justify-between { justify-content: space-between; }
                    .items-start { align-items: flex-start; }
                    .items-center { align-items: center; }
                    .border-b { border-bottom: 1px solid #e5e7eb; }
                    .border-t { border-top: 1px solid #e5e7eb; }
                    .pb-1 { padding-bottom: 4px; } .pb-4 { padding-bottom: 16px; }
                    .pt-1 { padding-top: 4px; } .pt-3 { padding-top: 12px; }
                    .mb-2 { margin-bottom: 8px; } .py-2 { padding: 8px 0; }
                    .text-right { text-align: right; } .text-center { text-align: center; }
                    .font-bold { font-weight: 700; } .font-semibold { font-weight: 600; }
                    .font-medium { font-weight: 500; }
                    .text-xl { font-size: 18px; } .text-lg { font-size: 16px; }
                    .text-2xl { font-size: 22px; } .text-base { font-size: 14px; }
                    .text-xs { font-size: 11px; }
                    .text-muted-foreground { color: #6b7280; }
                    .text-primary { color: #166534; }
                    .text-red-600 { color: #dc2626; }
                    .text-amber-600 { color: #d97706; }
                    .text-amber-700 { color: #b45309; }
                    .text-orange-600 { color: #ea580c; }
                    .rounded-lg { border-radius: 8px; } .border { border: 1px solid #e5e7eb; }
                    .p-4 { padding: 16px; } .p-8 { padding: 32px; }
                    .bg-primary\\/5 { background: #f0fdf4; }
                    .border-primary\\/20 { border-color: #bbf7d0; }
                    .gap-3 { gap: 12px; } .shrink-0 { flex-shrink: 0; }
                    .ml-1 { margin-left: 4px; }
                    svg { display: none; }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    };

    const fmt = (r: EnrichedRecord) =>
        new Date(r.month + '-01').toLocaleString('en-LK', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">My Payslips</h1>
                <p className="text-muted-foreground">View and download your released payslips.</p>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
            ) : records.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No payslips have been released yet. Contact HR if you expect one.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {records.map(record => (
                        <Card key={record.id} className="overflow-hidden">
                            {/* Row header */}
                            <CardHeader
                                className="cursor-pointer select-none py-4"
                                onClick={() => setExpanded(expanded === record.id ? null : record.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-base">{fmt(record)}</CardTitle>
                                        <Badge className="bg-blue-500 text-white text-xs">Released</Badge>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-primary">
                                            LKR {(record.snap?.net_salary ?? record.net_salary).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                        </span>
                                        {expanded === record.id
                                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        }
                                    </div>
                                </div>
                            </CardHeader>

                            {/* Expanded payslip */}
                            {expanded === record.id && (
                                <CardContent className="pt-0">
                                    <div id={`payslip-${record.id}`}>
                                        <PayslipView
                                            record={record}
                                            onPrint={() => handlePrint(record)}
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
