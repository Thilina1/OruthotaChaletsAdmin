'use client';

import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarRail,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Users, Utensils, Boxes, Building, Waves, Briefcase, Star, BookOpen, Hotel } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/icons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserContext } from '@/context/user-context';
import type { UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
    generalMenuItems,
    customerMenuItems,
    restaurantMenuItems,
    inventoryMenuItems,
    roomBookingMenuItems,
    chaletMenuItems,
    otherMenue,
    servicesMenuItems,
    hrmsMenuItems,
    otherMenuItems,
    type MenuItem,
} from '@/lib/route-config';

const renderMenuItems = (items: MenuItem[], userRole: UserRole | undefined, pathname: string) => {
    if (!userRole) return null;
    const accessible = items.filter(item => item.roles.includes(userRole));
    if (accessible.length === 0) return null;
    return accessible.map(item => (
        <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
                asChild
                tooltip={item.label}
                isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
            >
                <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    ));
};

function SidebarSection({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {label}
                </SidebarGroupLabel>
                <SidebarGroupContent>{children}</SidebarGroupContent>
            </SidebarGroup>
        </>
    );
}

export default function AppSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUserContext();

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
    };

    const role = user?.role;

    const customerSection    = renderMenuItems(customerMenuItems,    role, pathname);
    const restaurantSection  = renderMenuItems(restaurantMenuItems,  role, pathname);
    const inventorySection   = renderMenuItems(inventoryMenuItems,   role, pathname);
    const otherFinanceSection = renderMenuItems(otherMenue,          role, pathname);
    const servicesSection    = renderMenuItems(servicesMenuItems,    role, pathname);
    const reservationSection = renderMenuItems(roomBookingMenuItems, role, pathname);
    const chaletSection      = renderMenuItems(chaletMenuItems,      role, pathname);
    const hrmsSection        = renderMenuItems(hrmsMenuItems,        role, pathname);
    const miscSection        = renderMenuItems(otherMenuItems,       role, pathname);

    return (
        <Sidebar collapsible="icon">
            <SidebarRail />
            <SidebarHeader>
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Logo className="w-7 h-7 text-primary" />
                    <h2 className="text-lg font-headline font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                        Oruthota Chalets
                    </h2>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenu>
                    {/* General — Profile, User Management */}
                    {renderMenuItems(generalMenuItems, role, pathname)}

                    {customerSection && (
                        <SidebarSection label="Customers" icon={Users}>{customerSection}</SidebarSection>
                    )}

                    {restaurantSection && (
                        <SidebarSection label="Restaurant" icon={Utensils}>{restaurantSection}</SidebarSection>
                    )}

                    {inventorySection && (
                        <SidebarSection label="Inventory" icon={Boxes}>{inventorySection}</SidebarSection>
                    )}

                    {otherFinanceSection && (
                        <SidebarSection label="Other" icon={BookOpen}>{otherFinanceSection}</SidebarSection>
                    )}

                    {servicesSection && (
                        <SidebarSection label="Services" icon={Waves}>{servicesSection}</SidebarSection>
                    )}

                    {reservationSection && (
                        <SidebarSection label="Reservations" icon={Building}>{reservationSection}</SidebarSection>
                    )}

                    {chaletSection && (
                        <SidebarSection label="Chalet Booking" icon={Hotel}>{chaletSection}</SidebarSection>
                    )}

                    {hrmsSection && (
                        <SidebarSection label="HRMS" icon={Briefcase}>{hrmsSection}</SidebarSection>
                    )}

                    {miscSection && (
                        <SidebarSection label="Other" icon={Star}>{miscSection}</SidebarSection>
                    )}
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
                        <AvatarFallback className="text-xs">
                            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </AvatarFallback>
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
