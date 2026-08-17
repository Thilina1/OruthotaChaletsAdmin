'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, LayoutGrid, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/user-context';
import type { MenuItem } from '@/lib/route-config';
import {
    generalMenuItems, customerMenuItems, restaurantMenuItems, inventoryMenuItems,
    kitchenMenuItems, roomBookingMenuItems, chaletMenuItems, otherMenue,
    servicesMenuItems, hrmsMenuItems, otherMenuItems,
} from '@/lib/route-config';

const menuGroups: { title: string; description: string; items: MenuItem[] }[] = [
    { title: 'Account & Administration', description: 'Your profile and system administration tools.', items: generalMenuItems },
    { title: 'Customers', description: 'Guest services, customer records, and loyalty.', items: customerMenuItems },
    { title: 'Restaurant', description: 'Restaurant operations, billing, menus, and tables.', items: restaurantMenuItems },
    { title: 'Inventory', description: 'Stock, purchasing, approvals, and inventory reports.', items: inventoryMenuItems },
    { title: 'Kitchen', description: 'Kitchen orders and stock operations.', items: kitchenMenuItems },
    { title: 'Reservations', description: 'Rooms, inquiries, experiences, and buffet bookings.', items: roomBookingMenuItems },
    { title: 'Chalet Booking', description: 'Chalet bookings, rooms, rates, and packages.', items: chaletMenuItems },
    { title: 'Finance', description: 'Accounting, cash, expenses, and other income.', items: otherMenue },
    { title: 'Services', description: 'Income from guest services and excursions.', items: servicesMenuItems },
    { title: 'Human Resources', description: 'Employee, attendance, leave, payroll, and approvals.', items: hrmsMenuItems },
    { title: 'Content & Reports', description: 'Activities, experiences, blog content, and reporting.', items: otherMenuItems },
];

export default function HomeDashboardPage() {
    const { user, loading, hasPathAccess } = useUserContext();
    const [searchQuery, setSearchQuery] = useState('');

    if (loading || !user) {
        return <div className="space-y-8"><Skeleton className="h-32 w-full rounded-3xl" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}</div></div>;
    }

    const canAccess = (item: MenuItem) => {
        if (item.href === '/dashboard/home') return false;
        if ((user.role === 'admin' && !user.restrict_admin_permissions) || user.inventory_admin === true) return true;
        return hasPathAccess(item.href);
    };

    const accessibleGroups = menuGroups.map(group => ({ ...group, items: group.items.filter(canAccess) })).filter(group => group.items.length > 0);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const visibleGroups = accessibleGroups
        .map(group => ({
            ...group,
            items: group.items.filter(item =>
                !normalizedQuery ||
                item.label.toLowerCase().includes(normalizedQuery) ||
                group.title.toLowerCase().includes(normalizedQuery) ||
                group.description.toLowerCase().includes(normalizedQuery)
            ),
        }))
        .filter(group => group.items.length > 0);
    const firstName = user.name?.trim().split(/\s+/)[0] || 'there';
    const sectionCount = accessibleGroups.reduce((total, group) => total + group.items.length, 0);

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-8">
            <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-amber-500/10 p-4 shadow-sm sm:px-6 sm:py-5">
                <div className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex max-w-3xl items-center gap-4">
                        <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 sm:flex"><LayoutGrid className="size-5" /></div>
                        <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Your workspace</p>
                            <h1 className="font-headline text-xl font-bold tracking-tight sm:text-2xl">Welcome back, {firstName}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Choose a section below to get started. Only the areas available to your account are shown here.</p>
                        </div>
                    </div>
                    <div className="flex w-fit items-center gap-2 rounded-xl border bg-background/70 px-4 py-2 backdrop-blur-sm"><p className="text-xl font-bold text-foreground">{sectionCount}</p><p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Available sections</p></div>
                </div>
            </section>

            <div className="relative mx-auto max-w-2xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search your sections..."
                    aria-label="Search dashboard sections"
                    className="h-12 rounded-2xl border bg-card pl-12 pr-12 text-base shadow-sm focus-visible:ring-primary"
                />
                {searchQuery && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-1.5 top-1/2 size-9 -translate-y-1/2 rounded-xl text-muted-foreground"
                    >
                        <X className="size-4" />
                    </Button>
                )}
            </div>

            {visibleGroups.length > 0 ? visibleGroups.map(group => (
                <section key={group.title} className="space-y-3">
                    <div><h2 className="text-xl font-bold tracking-tight sm:text-2xl">{group.title}</h2><p className="mt-1 text-sm text-muted-foreground">{group.description}</p></div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                        {group.items.map(item => (
                            <Link key={item.href} href={item.href} className="group relative flex min-h-24 items-center gap-3 overflow-hidden rounded-xl border bg-card p-4 pr-9 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><item.icon className="size-5" /></div>
                                <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold leading-snug text-card-foreground">{item.label}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">Open section</p></div>
                                <ArrowUpRight className="absolute right-3 top-3 size-3.5 text-muted-foreground/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                            </Link>
                        ))}
                    </div>
                </section>
            )) : normalizedQuery ? (
                <div className="rounded-3xl border border-dashed bg-muted/30 px-6 py-16 text-center"><Search className="mx-auto mb-4 size-10 text-muted-foreground" /><h2 className="text-xl font-semibold">No matching sections</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Try another name or clear your search to see all available sections.</p><Button type="button" variant="outline" onClick={() => setSearchQuery('')} className="mt-5 rounded-xl">Clear search</Button></div>
            ) : (
                <div className="rounded-3xl border border-dashed bg-muted/30 px-6 py-16 text-center"><LayoutGrid className="mx-auto mb-4 size-10 text-muted-foreground" /><h2 className="text-xl font-semibold">No sections assigned yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Please contact an administrator to request access to the sections you need.</p></div>
            )}
        </div>
    );
}
