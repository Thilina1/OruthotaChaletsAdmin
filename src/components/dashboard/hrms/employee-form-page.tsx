'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, UserRoundPen } from 'lucide-react';
import type { User } from '@/lib/types';
import { UserForm } from '@/components/dashboard/user-management/user-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export function EmployeeFormPage({ userId }: { userId?: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [employee, setEmployee] = useState<User | null>(null);
    const [loading, setLoading] = useState(!!userId);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        if (!userId) return;
        fetch(`/api/admin/users?id=${userId}`)
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to load employee.');
                setEmployee(data.user);
            })
            .catch((error: Error) => {
                setLoadError(error.message);
                toast({ variant: 'destructive', title: 'Load Failed', description: error.message });
            })
            .finally(() => setLoading(false));
    }, [userId, toast]);

    const handleSubmit = async (values: any) => {
        const editing = !!userId;
        const response = await fetch(editing ? `/api/admin/users?id=${userId}` : '/api/admin/users', {
            method: editing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, ...(editing ? { id: userId } : {}) }),
        });
        const data = await response.json();
        if (!response.ok) {
            toast({ variant: 'destructive', title: editing ? 'Update Failed' : 'Creation Failed', description: data.error || 'Unable to save employee.' });
            return;
        }
        toast({ title: editing ? 'Employee Updated' : 'Employee Created', description: `${values.name} has been saved.` });
        router.push('/dashboard/hrms/employees');
        router.refresh();
    };

    if (loading) {
        return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-9 w-56" /><Skeleton className="h-[650px] w-full" /></div>;
    }

    if (userId && (loadError || !employee)) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard/hrms/employees')}><ArrowLeft className="h-4 w-4" /> Back to Employees</Button>
                <Card><CardHeader><CardTitle>Employee unavailable</CardTitle><CardDescription>{loadError || 'The requested employee could not be found.'}</CardDescription></CardHeader></Card>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
            <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard/hrms/employees')}>
                <ArrowLeft className="h-4 w-4" /> Back to Employees
            </Button>
            <Card>
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        {userId ? <UserRoundPen className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
                        {userId ? 'Edit Employee' : 'Add New Employee'}
                    </CardTitle>
                    <CardDescription>
                        {userId ? 'Update employee details, access, payroll, and calendar assignments.' : 'Create a complete employee profile and login account.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                    <UserForm user={employee} onSubmit={handleSubmit} />
                </CardContent>
            </Card>
        </div>
    );
}
