'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalarySettings } from '@/components/dashboard/hrms/payroll/salary-settings';
import { PayrollRun } from '@/components/dashboard/hrms/payroll/payroll-run';

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
                </TabsList>

                <TabsContent value="run-payroll" className="space-y-4">
                    <PayrollRun />
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <SalarySettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
