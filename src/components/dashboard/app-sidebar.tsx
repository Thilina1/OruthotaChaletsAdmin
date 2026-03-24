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
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, LayoutDashboard, Users, UserCog, UtensilsCrossed, Boxes, CreditCard, BarChart, BedDouble, Star, Building, Utensils, Zap, Newspaper, Gem, Settings, Calendar, ClipboardList, Briefcase, Banknote, Clock, FileBarChart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo } from '../icons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserContext } from '@/context/user-context';
import { SidebarRail } from '../ui/sidebar';
import type { UserRole } from '@/lib/types';
import {
  generalMenuItems,
  customerMenuItems,
  restaurantMenuItems,
  inventoryMenuItems,
  roomBookingMenuItems,
  otherMenue,
  hrmsMenuItems,
  otherMenuItems,
  MenuItem
} from '@/lib/route-config';

const renderMenuItems = (items: MenuItem[], hasPathAccess: (path: string) => boolean, pathname: string, userRole?: string) => {
  const accessibleItems = items.filter(item => {
    // Admins always get access
    if (userRole === 'admin') return true;

    // Check if the user has been explicitly granted this path via custom permissions
    const hasExplicitPermission = hasPathAccess(item.href);

    // Check if the user's role grants them default access to this section
    const hasRolePermission = userRole ? item.roles.includes(userRole as UserRole) : false;

    return hasExplicitPermission || hasRolePermission;
  });
  if (accessibleItems.length === 0) return null;

  return accessibleItems.map(item => {
    const isActive = pathname === item.href || (
      pathname.startsWith(item.href + '/') &&
      !items.some(other => other.href !== item.href && pathname.startsWith(other.href) && other.href.length > item.href.length)
    );

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
          <Link href={item.href}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

export default function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasPathAccess } = useUserContext();
  const avatar = PlaceHolderImages.find(p => p.id === 'avatar-2');
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh(); // Ensure middleware re-runs and context updates
  };

  const restaurantSection = renderMenuItems(restaurantMenuItems, hasPathAccess, pathname, user?.role);
  const inventorySection = renderMenuItems(inventoryMenuItems, hasPathAccess, pathname, user?.role);
  const roomBookingSection = renderMenuItems(roomBookingMenuItems, hasPathAccess, pathname, user?.role);
  const otherSection = renderMenuItems(otherMenue, hasPathAccess, pathname, user?.role);
  const customerSection = renderMenuItems(customerMenuItems, hasPathAccess, pathname, user?.role);
  const hrmsSection = renderMenuItems(hrmsMenuItems, hasPathAccess, pathname, user?.role);


  return (
    <Sidebar collapsible="icon">
      <SidebarRail />
      <SidebarHeader>
        <Link href="/dashboard/profile" className="flex items-center gap-2">
          <Logo className="w-7 h-7 text-primary" />
          <h2 className="text-lg font-headline font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">Oruthota Chalets</h2>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {renderMenuItems(generalMenuItems, hasPathAccess, pathname, user?.role)}


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

          {inventorySection && (
            <>
              <SidebarSeparator className="my-2" />
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2"><Boxes className="size-4" />Inventory</SidebarGroupLabel>
                <SidebarGroupContent>{inventorySection}</SidebarGroupContent>
              </SidebarGroup>
            </>
          )}



          {otherSection && (
            <>
              <SidebarSeparator className="my-2" />
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2">
                  <Zap className="size-4" />
                  Other
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  {otherSection}
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}




          {roomBookingSection && (
            <>
              <SidebarSeparator className="my-2" />
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2"><Building className="size-4" />Room Booking</SidebarGroupLabel>
                <SidebarGroupContent>{roomBookingSection}</SidebarGroupContent>
              </SidebarGroup>
            </>
          )}

          {hrmsSection && (
            <>
              <SidebarSeparator className="my-2" />
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2"><Briefcase className="size-4" />HRMS</SidebarGroupLabel>
                <SidebarGroupContent>{hrmsSection}</SidebarGroupContent>
              </SidebarGroup>
            </>
          )}



          <SidebarSeparator className="my-2" />
          {renderMenuItems(otherMenuItems, hasPathAccess, pathname, user?.role)}

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
            {avatar && <AvatarImage src={avatar.imageUrl} />}
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
