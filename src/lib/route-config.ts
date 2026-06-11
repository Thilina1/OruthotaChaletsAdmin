import { LayoutDashboard, Users, UserCog, UtensilsCrossed, Boxes, CreditCard, BarChart, BedDouble, Star, Building, Utensils, Zap, Newspaper, Gem, Settings, Calendar, ClipboardList, Briefcase, Banknote, Clock, FileBarChart, Warehouse, ShoppingCart, MessageSquare, PackagePlus, ClipboardCheck, Truck, History, Shirt, Car, Waves, Layers, CalendarDays, ShieldCheck } from 'lucide-react';
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
    { href: '/dashboard/user-management', icon: Users, label: 'User Management', roles: ['admin'] },
];

export const customerMenuItems: MenuItem[] = [
    { href: '/dashboard/front-desk', icon: ClipboardCheck, label: 'Front Desk (Check In/Out)', roles: ['admin', 'waiter'] },
    { href: '/dashboard/customers', icon: Users, label: 'All Customers', roles: ['admin', 'waiter'] },
    { href: '/dashboard/loyalty', icon: Gem, label: 'Loyalty Customers', roles: ['admin'] },
];

export const restaurantMenuItems: MenuItem[] = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'waiter', 'payment'] },
    { href: '/dashboard/billing', icon: CreditCard, label: 'Restaurant Billing', roles: ['admin', 'payment'] },
    { href: '/dashboard/menu-management', icon: UtensilsCrossed, label: 'Menu Management', roles: ['admin'] },
    { href: '/dashboard/table-management', icon: TableIcon, label: 'Table Management', roles: ['admin'] },
    { href: '/dashboard/menu-settings', icon: UtensilsCrossed, label: 'Menu Section Settings', roles: ['admin'] },
    { href: '/dashboard/restaurant-settings', icon: Settings, label: 'Restaurant Settings', roles: ['admin'] },
];

export const inventoryMenuItems: MenuItem[] = [
    { href: '/dashboard/inventory-management/warehouses', icon: Warehouse, label: 'Manage Store', roles: ['admin'] },
    { href: '/dashboard/inventory-management/add-item', icon: PackagePlus, label: 'Add New Item', roles: ['admin'] },
    { href: '/dashboard/inventory-requests', icon: Boxes, label: 'Inventory Requests', roles: ['admin'] },
    { href: '/dashboard/inventory-requests/history', icon: History, label: 'Inventory Approvals', roles: ['admin'] },
    { href: '/dashboard/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders', roles: ['admin'] },
    { href: '/dashboard/purchase-orders/approvals', icon: ClipboardCheck, label: 'PO Approvals', roles: ['admin'] },
    { href: '/dashboard/inventory-stock-overview', icon: BarChart, label: 'Stock Overview', roles: ['admin'] },
    { href: '/dashboard/inventory-management/grn', icon: Truck, label: 'GRN (Stock In)', roles: ['admin'] },
    { href: '/dashboard/inventory-management', icon: Boxes, label: 'Manage Items', roles: ['admin'] },
    { href: '/dashboard/inventory-reports', icon: FileBarChart, label: 'Inventory Reports', roles: ['admin'] },
];

export const roomBookingMenuItems: MenuItem[] = [
    { href: '/dashboard/room-management', icon: BedDouble, label: 'Room Management', roles: ['admin'] },
    { href: '/dashboard/reservations', icon: BedDouble, label: 'Reservation Management', roles: ['admin'] },
    { href: '/dashboard/inquiries', icon: MessageSquare, label: 'Inquiries', roles: ['admin'] },
    { href: '/dashboard/buffet-bookings', icon: Utensils, label: 'Buffet Bookings', roles: ['admin'] },
];

export const otherMenue: MenuItem[] = [
    { href: '/dashboard/expenses', icon: Zap, label: 'Expenses', roles: ['admin'] },
    { href: '/dashboard/other-incomes', icon: Zap, label: 'Other Incomes', roles: ['admin'] },
];

export const hrmsMenuItems: MenuItem[] = [
    { href: '/dashboard/hrms/employees', icon: Briefcase, label: 'Employees', roles: ['admin'] },
    { href: '/dashboard/hrms/leaves', icon: Calendar, label: 'Leaves', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/leave-schemes', icon: Layers, label: 'Leave Schemes', roles: ['admin'] },
    { href: '/dashboard/hrms/leave-approvals', icon: ShieldCheck, label: 'Leave Approvals', roles: ['admin'] },
    { href: '/dashboard/hrms/working-calendar', icon: CalendarDays, label: 'Working Calendar', roles: ['admin'] },
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

export const servicesMenuItems: MenuItem[] = [
    { href: '/dashboard/services/laundry', icon: Shirt, label: 'Laundry Income', roles: ['admin'] },
    { href: '/dashboard/services/transport', icon: Car, label: 'Transport & Excursion', roles: ['admin'] },
    { href: '/dashboard/services/spa', icon: Waves, label: 'Spa/Pool Income', roles: ['admin'] },
];

export const allMenuItems = [
    ...generalMenuItems,
    ...customerMenuItems,
    ...restaurantMenuItems,
    ...inventoryMenuItems,
    ...roomBookingMenuItems,
    ...otherMenue,
    ...servicesMenuItems,
    ...hrmsMenuItems,
    ...otherMenuItems,
];
