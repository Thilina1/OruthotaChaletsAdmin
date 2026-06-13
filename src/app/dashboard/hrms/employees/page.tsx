'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSupabaseCollection } from '@/hooks/use-supabase-collection';
import type { User, WorkingCalendar } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, CalendarDays } from 'lucide-react';
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
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { EmployeeCalendarDialog } from '@/components/dashboard/hrms/employee-calendar-dialog';

export default function EmployeeManagementPage() {
    const { toast } = useToast();
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [calendarEmployee, setCalendarEmployee] = useState<User | null>(null);
    const [calendars, setCalendars] = useState<WorkingCalendar[]>([]);

    useEffect(() => {
        fetch('/api/hrms/working-calendars')
            .then(r => r.json())
            .then(d => setCalendars(d.calendars ?? []))
            .catch(() => {});
    }, []);

    const calendarMap = useMemo(
        () => Object.fromEntries(calendars.map(c => [c.id, c])),
        [calendars]
    );

    const { data: users, loading: areUsersLoading, refetch } = useSupabaseCollection<User>('users');

    const handleFormSubmit = async (values: any) => {
        try {
            const url = editingUser ? `/api/admin/users?id=${editingUser.id}` : '/api/admin/users';
            const method = editingUser ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, id: editingUser ? editingUser.id : undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed to ${editingUser ? 'update' : 'create'} employee`);
            toast({ title: `Employee ${editingUser ? 'Updated' : 'Created'}`, description: `${values.name} has been ${editingUser ? 'updated' : 'created'}.` });
            setIsAddUserOpen(false);
            setEditingUser(null);
            refetch();
        } catch (error: any) {
            toast({ variant: 'destructive', title: editingUser ? 'Update Failed' : 'Creation Failed', description: error.message });
        }
    };

    const sortedUsers = useMemo(() => {
        if (!users) return [];
        return [...users].sort((a, b) => a.name.localeCompare(b.name));
    }, [users]);

    const { currentPage, totalPages, totalItems, paginatedItems, itemsPerPage, setCurrentPage } =
        usePagination(sortedUsers, 20);

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
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Employee Management</h1>
                    <p className="text-muted-foreground">Manage employee profiles, calendars, and details.</p>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={(open) => {
                    if (!open) setEditingUser(null);
                    setIsAddUserOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingUser(null); setIsAddUserOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Add Employee
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingUser ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                            <DialogDescription>
                                {editingUser
                                    ? 'Modify employee details and role. Leave password blank to keep it unchanged.'
                                    : 'Create a new employee account. They will use this to log in.'}
                            </DialogDescription>
                        </DialogHeader>
                        <UserForm user={editingUser} onSubmit={handleFormSubmit} />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Employees</CardTitle>
                    <CardDescription>
                        Manage staff profiles. Use the <strong>Calendar</strong> button to add or remove holidays per employee without affecting the shared calendar.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Job Title</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead>Calendar</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.map(user => {
                                const cal = user.working_calendar_id ? calendarMap[user.working_calendar_id] : null;
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            <div>{user.name}</div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                        </TableCell>
                                        <TableCell className="capitalize">{user.role}</TableCell>
                                        <TableCell>{user.department || '-'}</TableCell>
                                        <TableCell>{user.job_title || '-'}</TableCell>
                                        <TableCell>{user.join_date || '-'}</TableCell>
                                        <TableCell>
                                            {cal ? (
                                                <Badge variant="outline" className="text-xs gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {cal.name}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setCalendarEmployee(user)}>
                                                    <CalendarDays className="mr-2 h-4 w-4" /> Calendar
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => { setEditingUser(user); setIsAddUserOpen(true); }}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {!areUsersLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </CardContent>
            </Card>

            {calendarEmployee && (
                <EmployeeCalendarDialog
                    employee={calendarEmployee}
                    isOpen={!!calendarEmployee}
                    onClose={() => setCalendarEmployee(null)}
                />
            )}
        </div>
    );
}
