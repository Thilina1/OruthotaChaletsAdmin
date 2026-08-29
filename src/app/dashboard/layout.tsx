'use client';

import React, { type ReactNode } from 'react';
import AppSidebar from '@/components/dashboard/app-sidebar';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { UserProvider, useUserContext } from '@/context/user-context';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function DashboardContent({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { user, loading, hasPathAccess } = useUserContext();

    const hasAccess = React.useMemo(() => {
        if (!user || loading) return true;
        // The dashboard is the authenticated landing page and only displays
        // links that the current user is allowed to open.
        if (pathname === '/dashboard/home') return true;

        return hasPathAccess(pathname);
    }, [user, loading, hasPathAccess, pathname]);

    if (!hasAccess) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-4">
                <div className="bg-destructive/10 p-6 rounded-full">
                    <ShieldAlert className="size-16 text-destructive" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
                <p className="text-muted-foreground max-w-[500px]">
                    You don't have permission to access <strong>{pathname}</strong>.
                    Please contact your administrator if you believe this is a mistake.
                </p>
                <Button asChild variant="outline">
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
            </div>
        );
    }

    return (
        <>
            <AppSidebar />
            <SidebarInset>
                <DashboardHeader />
                <main className="flex-1 flex flex-col">
                    <div className="flex-1 p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </SidebarInset>
        </>
    );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <UserProvider>
            <div className="bg-muted/40 min-h-screen">
                <SidebarProvider>
                    <DashboardContent>{children}</DashboardContent>
                </SidebarProvider>
            </div>
        </UserProvider>
    );
}
