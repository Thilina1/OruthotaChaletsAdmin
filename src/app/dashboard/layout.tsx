'use client';

import React, { type ReactNode } from 'react';
import AppSidebar from '@/components/dashboard/app-sidebar';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { UserProvider, useUserContext } from '@/context/user-context';
import { usePathname } from 'next/navigation';
import { allMenuItems } from '@/lib/route-config';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function DashboardContent({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { user, loading, hasPathAccess } = useUserContext();

    // Check if the current route has role restrictions
    const currentMenuItem = allMenuItems.find(item =>
        pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
    );

    const hasAccess = React.useMemo(() => {
        if (!user || loading) return true; // Let the UserProvider handle loading state or basic auth
        if (user.role === 'admin') return true;

        // If it's a known menu item, check roles
        if (currentMenuItem) {
            const hasRoleAccess = currentMenuItem.roles.includes(user.role);
            const hasExplicitAccess = hasPathAccess(pathname);
            return hasRoleAccess || hasExplicitAccess;
        }

        // If it's not a known menu item (e.g., a sub-page), default to true for now 
        // or add more specific logic if sub-pages follow a pattern.
        return true;
    }, [user, loading, currentMenuItem, hasPathAccess, pathname]);

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
