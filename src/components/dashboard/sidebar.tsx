'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  ChefHat,
  BookOpenCheck,
    CreditCard,
    PackagePlus,
    ShoppingCart,
    ClipboardCheck,
} from 'lucide-react';
import { useUserContext } from '@/context/user-context';
import type { UserRole } from '@/lib/types';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  isSubItem?: boolean;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'waiter', 'kitchen', 'payment'],
  },
  {
    href: '/dashboard/tables',
    label: 'Tables',
    icon: BookOpenCheck,
    roles: ['admin', 'waiter'],
  },
  {
    href: '/dashboard/orders',
    label: 'Active Orders',
    icon: ClipboardList,
    roles: ['admin', 'kitchen'],
  },
  {
    href: '/dashboard/payment-processing',
    label: 'Payment Processing',
    icon: CreditCard,
    roles: ['admin', 'payment'],
  },
  {
    href: '/dashboard/inventory-management',
    label: 'Inventory',
    icon: ChefHat,
    roles: ['admin'],
  },
  {
    href: '/dashboard/purchase-orders',
    label: 'Purchase Order',
    icon: ShoppingCart,
    roles: ['admin'],
    isSubItem: true,
  },
  {
    href: '/dashboard/purchase-orders/approvals',
    label: 'PO Approvals',
    icon: ClipboardCheck,
    roles: ['admin'],
    isSubItem: true,
  },
  {
    href: '/dashboard/inventory-management/add-item',
    label: 'Register Item',
    icon: PackagePlus,
    roles: ['admin'],
    isSubItem: true,
  },
  {
    href: '/dashboard/user-management',
    label: 'User Management',
    icon: Users,
    roles: ['admin'],
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['admin'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasRole } = useUserContext();

  if (!user) {
    return null; // Don't render sidebar if no user
  }

  const filteredNavItems = navItems.filter(item => 
    item.roles.some(role => hasRole(role))
  );

  return (
    <aside className="w-64 h-full bg-background border-r flex flex-col fixed">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold font-headline">RMS</h2>
        <p className="text-sm text-muted-foreground capitalize">{user.role} View</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavItems.map(item => (
          <Button
            key={item.href}
            asChild
            variant={pathname === item.href ? 'secondary' : 'ghost'}
            className={cn(
              "w-full justify-start",
              item.isSubItem && "pl-10 text-muted-foreground scale-95"
            )}
          >
            <Link href={item.href}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
    </aside>
  );
}
