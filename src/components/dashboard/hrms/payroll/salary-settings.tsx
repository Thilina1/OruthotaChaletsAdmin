'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import type { User, SalaryDetails } from '@/lib/types';

interface EmployeeSalary extends User {
    basic_salary: number;
    fixed_allowances: number;
    settings_id?: string;
}

export function SalarySettings() {
    const [employees, setEmployees] = useState<EmployeeSalary[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const { toast } = useToast();
    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users
            // Fetch users
            const usersRes = await fetch('/api/admin/users');
            const usersJson = await usersRes.json();
            if (usersJson.error) throw new Error(usersJson.error);
            const usersData: User[] = usersJson.users || [];

            // Fetch settings
            const res = await fetch('/api/hrms/payroll/settings');
            const data = await res.json();
            const settings: SalaryDetails[] = data.salaryDetails || [];

            // Merge
            const merged = (usersData || []).map(user => {
                const setting = settings.find(s => s.user_id === user.id);
                return {
                    ...user,
                    basic_salary: setting?.basic_salary || 0,
                    fixed_allowances: setting?.fixed_allowances || 0,
                    settings_id: setting?.id
                };
            });

            setEmployees(merged);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to load salary settings." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleChange = (id: string, field: 'basic_salary' | 'fixed_allowances', value: string) => {
        const numValue = parseFloat(value) || 0;
        setEmployees(prev => prev.map(emp =>
            emp.id === id ? { ...emp, [field]: numValue } : emp
        ));
    };

    const handleSave = async (employee: EmployeeSalary) => {
        setSaving(employee.id);
        try {
            const res = await fetch('/api/hrms/payroll/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: employee.id,
                    basic_salary: employee.basic_salary,
                    fixed_allowances: employee.fixed_allowances
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: "Saved", description: `${employee.name}'s salary updated.` });

            // Update local state id if it was new
            if (data.salaryDetail?.id && !employee.settings_id) {
                setEmployees(prev => prev.map(emp =>
                    emp.id === employee.id ? { ...emp, settings_id: data.salaryDetail.id } : emp
                ));
            }

        } catch (error) {
            console.error("Error saving salary:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to save settings." });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return <div className="text-center py-10">Loading settings...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Employee Salary Configuration</CardTitle>
                <CardDescription>Set basic salary and fixed allowances for each employee.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Basic Salary (LKR)</TableHead>
                            <TableHead>Fixed Allowances (LKR)</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {employees.map(emp => (
                            <TableRow key={emp.id}>
                                <TableCell>
                                    <div className="font-medium">{emp.name}</div>
                                    <div className="text-xs text-muted-foreground">{emp.email}</div>
                                </TableCell>
                                <TableCell className="capitalize">{emp.role}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={emp.basic_salary || ''}
                                        onChange={(e) => handleChange(emp.id, 'basic_salary', e.target.value)}
                                        className="w-32"
                                        placeholder="0.00"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={emp.fixed_allowances || ''}
                                        onChange={(e) => handleChange(emp.id, 'fixed_allowances', e.target.value)}
                                        className="w-32"
                                        placeholder="0.00"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        onClick={() => handleSave(emp)}
                                        disabled={saving === emp.id}
                                    >
                                        {saving === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
