
'use client';

import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarTrigger,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarSeparator,
    SidebarGroupContent,
    SidebarRail,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, LayoutDashboard, Users, UserCog, UtensilsCrossed, Boxes, CreditCard, BarChart, BedDouble, Star, Building, Utensils, Zap, Newspaper, Calendar, Wallet, Banknote, Gem, Percent } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo, TableIcon } from '@/components/icons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserContext } from '@/context/user-context';
import type { UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface MenuItem {
    href: string;
    icon: React.ElementType;
    label: string;
    roles: UserRole[];
}

const generalMenuItems: MenuItem[] = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'waiter', 'payment'] },
    { href: '/dashboard/profile', icon: UserCog, label: 'Profile', roles: ['admin', 'waiter', 'payment'] },
    { href: '/dashboard/user-management', icon: Users, label: 'User Management', roles: ['admin'] },
];

const customerMenuItems: MenuItem[] = [
    { href: '/dashboard/loyalty', icon: Gem, label: 'Loyalty Customers', roles: ['admin', 'payment', 'waiter'] },
    { href: '/dashboard/loyalty-discounts', icon: Percent, label: 'Loyalty Discounts', roles: ['admin'] },
];

const restaurantMenuItems: MenuItem[] = [
    { href: '/dashboard/menu-management', icon: UtensilsCrossed, label: 'Menu Management', roles: ['admin'] },
    { href: '/dashboard/table-management', icon: TableIcon, label: 'Table Management', roles: ['admin'] },
    { href: '/dashboard/inventory-management', icon: Boxes, label: 'Inventory', roles: ['admin'] },
];

const roomBookingMenuItems: MenuItem[] = [
    { href: '/dashboard/room-management', icon: BedDouble, label: 'Room Management', roles: ['admin'] },
    { href: '/dashboard/bookings', icon: Calendar, label: 'Booking Management', roles: ['admin'] },
    { href: '/dashboard/reservations', icon: BedDouble, label: 'Reservation Management', roles: ['admin'] },
];

const moneyManagementMenuItems: MenuItem[] = [
    { href: '/dashboard/billing', icon: CreditCard, label: 'Restaurant Billing', roles: ['admin', 'payment'] },
    { href: '/dashboard/reports', icon: BarChart, label: 'Reports', roles: ['admin', 'payment'] },
    { href: '/dashboard/expenses', icon: Wallet, label: 'Expenses', roles: ['admin', 'payment'] },
    { href: '/dashboard/other-incomes', icon: Banknote, label: 'Other Incomes', roles: ['admin', 'payment'] },
];

const otherMenuItems: MenuItem[] = [
    { href: '/dashboard/activities', icon: Star, label: 'Activities', roles: ['admin'] },
    { href: '/dashboard/experiences', icon: Zap, label: 'Experiences', roles: ['admin'] },
    { href: '/dashboard/blogs', icon: Newspaper, label: 'Blog Management', roles: ['admin'] },
];


const renderMenuItems = (items: MenuItem[], userRole: UserRole | undefined, pathname: string) => {
    if (!userRole) return null;

    const accessibleItems = items.filter(item => item.roles.includes(userRole));
    if (accessibleItems.length === 0) return null;

    return accessibleItems.map(item => (
        <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild tooltip={item.label} isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}>
                <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    ));
}

export default function AppSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUserContext();

    const avatar = PlaceHolderImages.find(p => p.id === 'avatar-1');

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
    };

    const customerSection = renderMenuItems(customerMenuItems, user?.role, pathname);
    const restaurantSection = renderMenuItems(restaurantMenuItems, user?.role, pathname);
    const roomBookingSection = renderMenuItems(roomBookingMenuItems, user?.role, pathname);
    const moneyManagementSection = renderMenuItems(moneyManagementMenuItems, user?.role, pathname);

    return (
        <Sidebar collapsible="icon">
            <SidebarRail />
            <SidebarHeader>
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Logo className="w-7 h-7 text-primary" />
                    <h2 className="text-lg font-headline font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">Oruthota Chalets</h2>
                </Link>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {renderMenuItems(generalMenuItems, user?.role, pathname)}

                    {customerSection && (
                        <>
                            <SidebarSeparator className="my-2" />
                            <SidebarGroup>
                                <SidebarGroupLabel className="flex items-center gap-2"><Users className="size-4" />Customers</SidebarGroupLabel>
                                <SidebarGroupContent>{customerSection}</SidebarGroupContent>
                            </SidebarGroup>
                        </>
                    )}

                    {restaurantSection && (
                        <>
                            <SidebarSeparator className="my-2" />
                            <SidebarGroup>
                                <SidebarGroupLabel className="flex items-center gap-2"><Utensils className="size-4" />Restaurant</SidebarGroupLabel>
                                <SidebarGroupContent>{restaurantSection}</SidebarGroupContent>
                            </SidebarGroup>
                        </>
                    )}

                    {roomBookingSection && (
                        <>
                            <SidebarSeparator className="my-2" />
                            <SidebarGroup>
                                <SidebarGroupLabel className="flex items-center gap-2"><Building className="size-4" />Room Bookings</SidebarGroupLabel>
                                <SidebarGroupContent>{roomBookingSection}</SidebarGroupContent>
                            </SidebarGroup>
                        </>
                    )}

                    {moneyManagementSection && (
                        <>
                            <SidebarSeparator className="my-2" />
                            <SidebarGroup>
                                <SidebarGroupLabel className="flex items-center gap-2"><Wallet className="size-4" />Money Management</SidebarGroupLabel>
                                <SidebarGroupContent>{moneyManagementSection}</SidebarGroupContent>
                            </SidebarGroup>
                        </>
                    )}

                    <SidebarSeparator className="my-2" />
                    {renderMenuItems(otherMenuItems, user?.role, pathname)}

                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={logout} tooltip="Logout">
                            <LogOut />
                            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <SidebarSeparator className="my-1" />
                <Link href="/dashboard/profile" className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                    <Avatar className="size-8">
                        {user?.name && <AvatarImage src={user?.name} />}
                        <AvatarFallback className="text-xs">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                        <span className="font-semibold text-sm truncate">{user?.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
                    </div>
                </Link>
            </SidebarFooter>
        </Sidebar>
    );
}
