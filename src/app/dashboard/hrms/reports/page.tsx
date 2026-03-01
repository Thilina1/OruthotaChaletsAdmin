'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DailyReportForm } from '@/components/dashboard/hrms/daily-report-form';
import type { DailyReport } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function DailyReportsPage() {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        };
        getUser();
    }, [supabase]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/reports');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setReports(data.reports || []);
        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch reports." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(reports, 20);

    const handleCreateReport = async (values: any) => {
        try {
            const res = await fetch('/api/hrms/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, user_id: userId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: "Report Submitted", description: "Your daily report has been saved." });
            setIsReportOpen(false);
            fetchReports();
        } catch (error) {
            console.error("Error submitting report:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to submit report." });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Daily Reports</h1>
                    <p className="text-muted-foreground">Submit and view daily work reports.</p>
                </div>
                <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Submit Daily Report</DialogTitle>
                        </DialogHeader>
                        <DailyReportForm onSubmit={handleCreateReport} />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Report History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Tasks Completed</TableHead>
                                <TableHead>Issues</TableHead>
                                <TableHead>Next Day Plan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(!paginatedItems || paginatedItems.length === 0) ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No reports found.</TableCell></TableRow>
                            ) : (
                                paginatedItems.map(report => (
                                    <TableRow key={report.id}>
                                        <TableCell>{report.date}</TableCell>
                                        <TableCell>
                                            {/* @ts-ignore: users data joined optionally */}
                                            {report.users?.name || 'Unknown'}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate" title={report.tasks_completed}>{report.tasks_completed}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={report.issues_faced || ''}>{report.issues_faced || '-'}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={report.next_day_plan || ''}>{report.next_day_plan || '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
