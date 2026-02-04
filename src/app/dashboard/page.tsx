
'use client';

import type { User } from '@/lib/types';
import AdminDashboard from '@/components/dashboard/admin-dashboard';
import WaiterDashboard from '@/components/dashboard/waiter-dashboard';
import PaymentDashboard from '@/components/dashboard/payment-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserContext } from '@/context/user-context';

export default function DashboardPage() {
    const { user } = useUserContext();

    if (!user) {
         return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    const renderDashboard = () => {
        switch (user?.role) {
            case 'admin':
                return <AdminDashboard />;
            case 'waiter':
                return <WaiterDashboard />;
            case 'payment':
                return <PaymentDashboard />;
            default:
                // For payment role, we can show the payment dashboard as a default
                // if we want to combine roles or show a specific view.
                // For now, let's assume 'payment' has its own dashboard.
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold">Invalid Role</h2>
                        <p>Your user role is not configured correctly.</p>
                    </div>
                );
        }
    };

    return renderDashboard();
}
