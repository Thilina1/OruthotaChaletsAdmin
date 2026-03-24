import { LayoutDashboard, Users, UserCog, UtensilsCrossed, Boxes, CreditCard, BarChart, BedDouble, Star, Building, Utensils, Zap, Newspaper, Gem, Settings, Calendar, ClipboardList, Briefcase, Banknote, Clock, FileBarChart, Warehouse, ShoppingCart } from 'lucide-react';
import { TableIcon } from '@/components/icons';
import type { UserRole } from '@/lib/types';

export interface MenuItem {
    href: string;
    icon: React.ElementType;
    label: string;
    roles: UserRole[];
}

export const generalMenuItems: MenuItem[] = [
    { href: '/dashboard/profile', icon: UserCog, label: 'Profile', roles: ['admin', 'waiter', 'payment'] },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'waiter', 'payment'] },
    { href: '/dashboard/user-management', icon: Users, label: 'User Management', roles: ['admin'] },
];

export const customerMenuItems: MenuItem[] = [
    { href: '/dashboard/loyalty', icon: Gem, label: 'Loyalty Customers', roles: ['admin'] },
];

export const restaurantMenuItems: MenuItem[] = [
    { href: '/dashboard/billing', icon: CreditCard, label: 'Restaurant Billing', roles: ['admin', 'payment'] },
    { href: '/dashboard/menu-management', icon: UtensilsCrossed, label: 'Menu Management', roles: ['admin'] },
    { href: '/dashboard/table-management', icon: TableIcon, label: 'Table Management', roles: ['admin'] },
    { href: '/dashboard/menu-settings', icon: UtensilsCrossed, label: 'Menu Section Settings', roles: ['admin'] },
    { href: '/dashboard/restaurant-settings', icon: Settings, label: 'Restaurant Settings', roles: ['admin'] },
];

export const inventoryMenuItems: MenuItem[] = [
    { href: '/dashboard/inventory-management/warehouses', icon: Warehouse, label: 'Manage Store', roles: ['admin'] },
    { href: '/dashboard/inventory-management/stock-overview', icon: BarChart, label: 'Stock Overview', roles: ['admin'] },
    // { href: '/dashboard/inventory-management', icon: Boxes, label: 'Inventory', roles: ['admin'] },
    { href: '/dashboard/inventory-requests', icon: Boxes, label: 'Inventory Requests', roles: ['admin'] },
    { href: '/dashboard/inventory-reports', icon: FileBarChart, label: 'Inventory Reports', roles: ['admin'] },
    { href: '/dashboard/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders', roles: ['admin'] },
];

export const roomBookingMenuItems: MenuItem[] = [
    { href: '/dashboard/room-management', icon: BedDouble, label: 'Room Management', roles: ['admin'] },
    { href: '/dashboard/reservations', icon: BedDouble, label: 'Reservation Management', roles: ['admin'] },
];

export const otherMenue: MenuItem[] = [
    { href: '/dashboard/expenses', icon: Zap, label: 'Expenses', roles: ['admin'] },
    { href: '/dashboard/other-incomes', icon: Zap, label: 'Other Incomes', roles: ['admin'] },
];

export const hrmsMenuItems: MenuItem[] = [
    { href: '/dashboard/hrms/employees', icon: Briefcase, label: 'Employees', roles: ['admin'] },
    { href: '/dashboard/hrms/leaves', icon: Calendar, label: 'Leaves', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/reports', icon: ClipboardList, label: 'Daily Reports', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/payroll', icon: Banknote, label: 'Payroll', roles: ['admin'] },
    { href: '/dashboard/hrms/attendance', icon: Clock, label: 'Attendance', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
];

export const otherMenuItems: MenuItem[] = [
    { href: '/dashboard/activities', icon: Star, label: 'Activities', roles: ['admin'] },
    { href: '/dashboard/experiences', icon: Zap, label: 'Experiences', roles: ['admin'] },
    { href: '/dashboard/blogs', icon: Newspaper, label: 'Blog Management', roles: ['admin'] },
    { href: '/dashboard/reports', icon: BarChart, label: 'Reports', roles: ['admin', 'payment'] },
];

export const allMenuItems = [
    ...generalMenuItems,
    ...customerMenuItems,
    ...restaurantMenuItems,
    ...inventoryMenuItems,
    ...roomBookingMenuItems,
    ...otherMenue,
    ...hrmsMenuItems,
    ...otherMenuItems,
];
