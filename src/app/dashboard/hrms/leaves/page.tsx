'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { LeaveRequestForm } from '@/components/dashboard/hrms/leave-request-form';
import type { Leave } from '@/lib/types';
import { Badge } from "@/components/ui/badge";
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function LeaveManagementPage() {
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // Fetch user role from public users table if needed, or use metadata
                const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
                setUserRole(userData?.role || null);
            }
        };
        getUser();
    }, [supabase]);

    const fetchLeaves = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/hrms/leaves');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setLeaves(data.leaves || []);
        } catch (error) {
            console.error("Error fetching leaves:", error);
            const msg = (error as Error).message;
            setError(msg);
            toast({ variant: 'destructive', title: "Error", description: msg });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaves();
    }, []);

    const handleCreateLeave = async (values: any) => {
        try {
            const res = await fetch('/api/hrms/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, user_id: userId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: "Request Sent", description: "Your leave request has been submitted." });
            setIsRequestOpen(false);
            fetchLeaves();
        } catch (error) {
            console.error("Error creating leave:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to submit leave request." });
        }
    };

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        try {
            const res = await fetch('/api/hrms/leaves', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, approved_by: userId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: "Status Updated", description: `Leave request ${status}.` });
            fetchLeaves();
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to update status." });
        }
    };

    const myLeaves = leaves.filter(l => l.user_id === userId);
    // const pendingLeaves = leaves.filter(l => l.status === 'pending'); // Unused

    const {
        currentPage: myCurrentPage,
        totalPages: myTotalPages,
        totalItems: myTotalItems,
        paginatedItems: myPaginatedItems,
        itemsPerPage: myItemsPerPage,
        setCurrentPage: setMyCurrentPage,
    } = usePagination(myLeaves, 20);

    const {
        currentPage: adminCurrentPage,
        totalPages: adminTotalPages,
        totalItems: adminTotalItems,
        paginatedItems: adminPaginatedItems,
        itemsPerPage: adminItemsPerPage,
        setCurrentPage: setAdminCurrentPage,
    } = usePagination(leaves, 20);

    if (error && error.includes('relation "leaves" does not exist')) {
        return (
            <div className="p-10 text-center space-y-4">
                <h2 className="text-2xl font-bold text-red-600">Setup Required</h2>
                <p className="text-gray-600">The <strong>leaves</strong> table does not exist in your database.</p>
                <div className="p-4 bg-gray-100 rounded-md text-left mx-auto max-w-2xl overflow-auto">
                    <p className="mb-2 font-semibold">Please run the following SQL in your Supabase Dashboard:</p>
                    <pre className="text-xs">
                        {`-- Create leaves table
CREATE TABLE IF NOT EXISTS leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('annual', 'sick', 'casual', 'nopay')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own leaves" ON leaves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create leaves" ON leaves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all leaves" ON leaves FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
`}
                    </pre>
                </div>
                <Button onClick={fetchLeaves}>I've ran the SQL, Try Again</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Leave Management</h1>
                    <p className="text-muted-foreground">Request and manage employee leaves.</p>
                </div>
                <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Request Leave
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Request Leave</DialogTitle>
                        </DialogHeader>
                        <LeaveRequestForm onSubmit={handleCreateLeave} />
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="my-leaves">
                <TabsList>
                    <TabsTrigger value="my-leaves">My Leaves</TabsTrigger>
                    {userRole === 'admin' && <TabsTrigger value="all-requests">All Requests</TabsTrigger>}
                </TabsList>

                <TabsContent value="my-leaves" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Leave History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Dates</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!myPaginatedItems || myPaginatedItems.length === 0) ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No leave records found.</TableCell></TableRow>
                                    ) : (
                                        myPaginatedItems.map(leave => (
                                            <TableRow key={leave.id}>
                                                <TableCell className="capitalize">{leave.type}</TableCell>
                                                <TableCell>{leave.start_date} to {leave.end_date}</TableCell>
                                                <TableCell>{leave.reason}</TableCell>
                                                <TableCell>
                                                    <Badge variant={leave.status === 'approved' ? 'default' : leave.status === 'rejected' ? 'destructive' : 'secondary'}>
                                                        {leave.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <DataTablePagination
                                currentPage={myCurrentPage}
                                totalPages={myTotalPages}
                                totalItems={myTotalItems}
                                itemsPerPage={myItemsPerPage}
                                onPageChange={setMyCurrentPage}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {userRole === 'admin' && (
                    <TabsContent value="all-requests" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Leave Requests</CardTitle>
                                <CardDescription>Manage incoming leave requests.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Dates</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(!adminPaginatedItems || adminPaginatedItems.length === 0) ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No records found.</TableCell></TableRow>
                                        ) : (
                                            adminPaginatedItems.map(leave => (
                                                <TableRow key={leave.id}>
                                                    <TableCell>
                                                        {/* @ts-ignore: users data joined optionally */}
                                                        {leave.users?.name || 'Unknown'}
                                                    </TableCell>
                                                    <TableCell className="capitalize">{leave.type}</TableCell>
                                                    <TableCell>{leave.start_date} to {leave.end_date}</TableCell>
                                                    <TableCell>{leave.reason}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={leave.status === 'approved' ? 'default' : leave.status === 'rejected' ? 'destructive' : 'secondary'}>
                                                            {leave.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        {leave.status === 'pending' && (
                                                            <>
                                                                <Button size="sm" onClick={() => handleUpdateStatus(leave.id, 'approved')}>Approve</Button>
                                                                <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(leave.id, 'rejected')}>Reject</Button>
                                                            </>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )))}
                                    </TableBody>
                                </Table>
                                <DataTablePagination
                                    currentPage={adminCurrentPage}
                                    totalPages={adminTotalPages}
                                    totalItems={adminTotalItems}
                                    itemsPerPage={adminItemsPerPage}
                                    onPageChange={setAdminCurrentPage}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
