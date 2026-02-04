'use client';

import React, { type ReactNode } from 'react';
import AppSidebar from '@/components/dashboard/app-sidebar';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { UserProvider } from '@/context/user-context';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <UserProvider>
            <div className="bg-muted/40 min-h-screen">
                <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset>
                        <DashboardHeader />
                        <main className="flex-1 flex flex-col">
                            <div className="flex-1 p-4 sm:p-6 lg:p-8">
                                {children}
                            </div>
                        </main>
                    </SidebarInset>
                </SidebarProvider>
            </div>
        </UserProvider>
    );
}
