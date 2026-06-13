'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Play, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import type { User, SalaryDetails, PayrollRecord } from '@/lib/types';
import { Badge } from "@/components/ui/badge";

interface ProcessEmployee extends User {
    salary?: SalaryDetails;
    payroll?: PayrollRecord;
    calculated?: {
        basic: number;
        allowances: number;
        epf_employee: number;
        epf_employer: number;
        etf_employer: number;
        gross: number;
        net: number;
    }
}

export function PayrollRun() {
    const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [employees, setEmployees] = useState<ProcessEmployee[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null); // user_id processing
    const { toast } = useToast();
    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('*')
                .order('name');
            if (usersError) throw usersError;

            // 2. Fetch Salary Settings
            const resSettings = await fetch('/api/hrms/payroll/settings');
            const dataSettings = await resSettings.json();
            const settings: SalaryDetails[] = dataSettings.salaryDetails || [];

            // 3. Fetch Existing Payroll for this month
            const resPayroll = await fetch(`/api/hrms/payroll/process?month=${month}`);
            const dataPayroll = await resPayroll.json();
            const payrolls: PayrollRecord[] = dataPayroll.payrollRecords || [];

            // 4. Merge
            const merged = (usersData || []).map(user => {
                const setting = settings.find(s => s.user_id === user.id);
                const record = payrolls.find(p => p.user_id === user.id);

                // Pre-calculate just for display if not processed
                const basic = setting?.basic_salary || 0;
                const allowances = setting?.fixed_allowances || 0;
                const epf8 = basic * 0.08;
                const epf12 = basic * 0.12;
                const etf3 = basic * 0.03;
                const gross = basic + allowances;
                const net = gross - epf8; // Simplified, excluding tax for preview

                return {
                    ...user,
                    salary: setting,
                    payroll: record,
                    calculated: {
                        basic,
                        allowances,
                        epf_employee: epf8,
                        epf_employer: epf12,
                        etf_employer: etf3,
                        gross,
                        net
                    }
                };
            });

            setEmployees(merged);

        } catch (error) {
            console.error("Error fetching payroll data:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to load payroll data." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [month]); // Refetch when month changes

    const handleProcess = async (employee: ProcessEmployee) => {
        setProcessing(employee.id);
        try {
            const basic = employee.salary?.basic_salary || 0;
            const allowances = employee.salary?.fixed_allowances || 0;

            // In a real app, you might want to allow editing "Deductions" or "Tax" before processing.
            // For now we use defaults.

            const res = await fetch('/api/hrms/payroll/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: employee.id,
                    month: month,
                    basic_salary: basic,
                    allowances: allowances,
                    deductions: 0,
                    tax: 0,
                    status: 'processed'
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || data.details || 'Unknown error');

            toast({ title: "Processed", description: `Payroll processed for ${employee.name}.` });
            fetchData();
        } catch (error: any) {
            console.error("Error processing payroll:", error);
            toast({ variant: 'destructive', title: "Payroll Error", description: error.message || "Failed to process payroll." });
        } finally {
            setProcessing(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Run Payroll</CardTitle>
                        <CardDescription>Calculate and finalize salaries for the month.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Select Month:</span>
                        <Input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-auto"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Basic + Allowances</TableHead>
                            <TableHead>Gross</TableHead>
                            <TableHead>EPF (8%) / Employer</TableHead>
                            <TableHead>Net Salary</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {employees.map(emp => {
                            const isProcessed = !!emp.payroll;
                            return (
                                <TableRow key={emp.id}>
                                    <TableCell>
                                        <div className="font-medium">{emp.name}</div>
                                        <div className="text-xs text-muted-foreground">{emp.job_title || emp.role} {emp.department ? `· ${emp.department}` : ''}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium">LKR {emp.calculated?.basic.toLocaleString()}</div>
                                        <div className="text-xs text-muted-foreground">+LKR {emp.calculated?.allowances.toLocaleString()} allowances</div>
                                    </TableCell>
                                    <TableCell>
                                        {emp.salary ? `LKR ${emp.calculated?.gross.toLocaleString()}` : <span className="text-xs text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs">Employee: LKR {emp.calculated?.epf_employee.toFixed(2)}</div>
                                        <div className="text-xs text-muted-foreground">Employer: LKR {(emp.calculated!.epf_employer + emp.calculated!.etf_employer).toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {emp.salary
                                            ? `LKR ${isProcessed ? emp.payroll?.net_salary.toLocaleString() : emp.calculated?.net.toLocaleString()}`
                                            : <span className="text-xs text-muted-foreground italic">No salary set</span>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        {isProcessed ? (
                                            <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Processed</Badge>
                                        ) : (
                                            <Badge variant="secondary">Draft</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            onClick={() => handleProcess(emp)}
                                            disabled={isProcessed || processing === emp.id || !emp.salary}
                                            variant={isProcessed ? "outline" : "default"}
                                            title={!emp.salary ? 'Set salary first in Employee Management' : undefined}
                                        >
                                            {processing === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isProcessed ? "Done" : <><Play className="h-4 w-4 mr-1" /> Process</>}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {employees.length === 0 && !loading && (
                            <TableRow><TableCell colSpan={7} className="text-center py-4">No employees found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
