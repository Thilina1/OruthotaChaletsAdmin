'use client';

import { useState, useMemo } from 'react';
import { useSupabaseCollection } from '@/hooks/use-supabase-collection';
import { createClient } from '@/lib/supabase/client';
import type { User, UserRole } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { UserForm } from '@/components/dashboard/user-management/user-form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export default function EmployeeManagementPage() {
    const { toast } = useToast();
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);

    // Fetch all users for now, maybe filter by role later if needed
    const { data: users, loading: areUsersLoading, refetch } = useSupabaseCollection<User>('users');

    const handleAddUser = async (values: any) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create employee');
            }

            toast({ title: 'Employee Created', description: `Employee ${values.name} has been successfully created.` });
            setIsAddUserOpen(false);
            refetch();
        } catch (error: any) {
            console.error("Error creating employee:", error);
            toast({ variant: 'destructive', title: 'Creation Failed', description: error.message });
        }
    };

    const sortedUsers = useMemo(() => {
        if (!users) return [];
        // Filter out admins if strictly strictly employees, but maybe admins are employees too.
        // For now list everyone but maybe emphasize role
        return [...users].sort((a, b) => a.name.localeCompare(b.name));
    }, [users]);


    if (areUsersLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="w-1/4"><Skeleton className="h-6 w-full" /></div>
                                    <div className="w-1/4"><Skeleton className="h-6 w-full" /></div>
                                    <div className="w-1/4"><Skeleton className="h-10 w-full" /></div>
                                    <div className="w-1/6 flex gap-2"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-10 w-1/2" /></div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Employee Management</h1>
                    <p className="text-muted-foreground">Manage employee profiles and details.</p>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add Employee
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add New Employee</DialogTitle>
                            <DialogDescription>
                                Create a new employee account. They will use this to log in.
                            </DialogDescription>
                        </DialogHeader>
                        <UserForm onSubmit={handleAddUser} />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Employees</CardTitle>
                    <CardDescription>View all staff members.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Job Title</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <div>{user.name}</div>
                                        <div className="text-xs text-muted-foreground">{user.email}</div>
                                    </TableCell>
                                    <TableCell className="capitalize">{user.role}</TableCell>
                                    <TableCell>{user.job_title || '-'}</TableCell>
                                    <TableCell>{user.phone_number || '-'}</TableCell>
                                    <TableCell>{user.join_date || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
