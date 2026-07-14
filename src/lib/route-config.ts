import { LayoutDashboard, Users, UserCog, UtensilsCrossed, Boxes, CreditCard, BarChart, BedDouble, Star, Building, Utensils, Zap, Newspaper, Gem, Settings, Calendar, ClipboardList, Briefcase, Banknote, Clock, FileBarChart, Warehouse, ShoppingCart, MessageSquare, PackagePlus, ClipboardCheck, Truck, History, Shirt, Car, Waves, Layers, CalendarDays, ShieldCheck, Coins, ReceiptText, SlidersHorizontal, HardHat, BookOpen, AlarmClock, CheckSquare, Wallet, PackageOpen, AlertTriangle } from 'lucide-react';
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
    { href: '/dashboard/restaurant-analytics', icon: BarChart, label: 'Restaurant Analytics', roles: ['admin'] },
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
    { href: '/dashboard/inventory-cash-requests', icon: Wallet, label: 'Cash Requests', roles: ['admin'] },
    { href: '/dashboard/inventory-cash-approvals', icon: CheckSquare, label: 'Cash Approvals', roles: ['admin'] },
    { href: '/dashboard/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders', roles: ['admin'] },
    { href: '/dashboard/purchase-orders/approvals', icon: ClipboardCheck, label: 'PO Approvals', roles: ['admin'] },
    { href: '/dashboard/inventory-stock-overview', icon: BarChart, label: 'Stock Overview', roles: ['admin'] },
    { href: '/dashboard/inventory-management/grn', icon: Truck, label: 'GRN (Stock In)', roles: ['admin'] },
    { href: '/dashboard/inventory-management', icon: Boxes, label: 'Manage Items', roles: ['admin'] },
    { href: '/dashboard/inventory-management/stock-usage', icon: PackageOpen, label: 'Stock Usage', roles: ['admin', 'waiter', 'payment'] },
    { href: '/dashboard/inventory-management/expired-damaged', icon: AlertTriangle, label: 'Expired & Damaged', roles: ['admin'] },
    { href: '/dashboard/inventory-management/transaction-log', icon: History, label: 'Transaction Log', roles: ['admin'] },
    { href: '/dashboard/inventory-reports', icon: FileBarChart, label: 'Inventory Reports', roles: ['admin'] },
];

export const roomBookingMenuItems: MenuItem[] = [
    { href: '/dashboard/room-management', icon: BedDouble, label: 'Room Management', roles: ['admin'] },
    { href: '/dashboard/reservations', icon: BedDouble, label: 'Reservation Management', roles: ['admin'] },
    { href: '/dashboard/inquiries', icon: MessageSquare, label: 'Inquiries', roles: ['admin'] },
    { href: '/dashboard/buffet-bookings', icon: Utensils, label: 'Buffet Bookings', roles: ['admin'] },
];

export const otherMenue: MenuItem[] = [
    { href: '/dashboard/accounting', icon: BookOpen, label: 'Accounting', roles: ['admin'] },
    { href: '/dashboard/accounting/inventory-cash', icon: Banknote, label: 'Inventory Cash', roles: ['admin', 'payment'] },
    { href: '/dashboard/expenses', icon: Zap, label: 'Expenses', roles: ['admin'] },
    { href: '/dashboard/other-incomes', icon: Zap, label: 'Other Incomes', roles: ['admin'] },
];

export const hrmsMenuItems: MenuItem[] = [
    { href: '/dashboard/hrms/employees', icon: Briefcase, label: 'Employees', roles: ['admin'] },
    { href: '/dashboard/hrms/leaves', icon: Calendar, label: 'Leaves', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/leave-schemes', icon: Layers, label: 'Leave Schemes', roles: ['admin'] },
    { href: '/dashboard/hrms/leave-approvals', icon: ShieldCheck, label: 'Leave Approvals', roles: ['admin'] },
    { href: '/dashboard/hrms/manager-leave-approvals', icon: Users, label: 'Manager Leave Approvals', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/working-calendar', icon: CalendarDays, label: 'Working Calendar', roles: ['admin'] },
    { href: '/dashboard/hrms/reports', icon: ClipboardList, label: 'Daily Reports', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/payroll', icon: Banknote, label: 'Payroll', roles: ['admin'] },
    { href: '/dashboard/hrms/payroll-summary', icon: ReceiptText, label: 'Payroll Summary', roles: ['admin'] },
    { href: '/dashboard/hrms/apit-settings', icon: SlidersHorizontal, label: 'APIT Tax Settings', roles: ['admin'] },
    { href: '/dashboard/hrms/payslip', icon: Banknote, label: 'My Payslips', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/allowance-types', icon: Coins, label: 'Allowance Types', roles: ['admin'] },
    { href: '/dashboard/hrms/job-titles', icon: Briefcase, label: 'Job Titles', roles: ['admin'] },
    { href: '/dashboard/hrms/attendance', icon: Clock, label: 'Attendance', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/daily-workers', icon: HardHat, label: 'Daily Workers', roles: ['admin'] },
    { href: '/dashboard/hrms/ot', icon: AlarmClock, label: 'My OT Requests', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/manager-ot-approvals', icon: CheckSquare, label: 'Manager OT Approvals', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/ot-approvals', icon: CheckSquare, label: 'OT Approvals', roles: ['admin'] },
    { href: '/dashboard/hrms/ot-settings', icon: SlidersHorizontal, label: 'OT Settings', roles: ['admin'] },
    { href: '/dashboard/settings/roles', icon: ShieldCheck, label: 'Role Permissions', roles: ['admin'] },
    { href: '/dashboard/hrms/petty-cash', icon: Wallet, label: 'My Petty Cash', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/petty-cash-approvals', icon: CheckSquare, label: 'Petty Cash Approvals', roles: ['admin', 'waiter', 'kitchen', 'payment'] },
    { href: '/dashboard/hrms/petty-cash-accounts', icon: Banknote, label: 'Petty Cash (Accounts)', roles: ['admin', 'payment'] },
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

export const chaletMenuItems: MenuItem[] = [
    { href: '/dashboard/chalet/bookings', icon: BedDouble, label: 'Chalet Bookings', roles: ['admin'] },
    { href: '/dashboard/chalet/rooms', icon: BedDouble, label: 'Chalet Rooms', roles: ['admin'] },
    { href: '/dashboard/chalet/rates', icon: BedDouble, label: 'Room Rates & Packages', roles: ['admin'] },
];

export const allMenuItems = [
    ...generalMenuItems,
    ...customerMenuItems,
    ...restaurantMenuItems,
    ...inventoryMenuItems,
    ...roomBookingMenuItems,
    ...chaletMenuItems,
    ...otherMenue,
    ...servicesMenuItems,
    ...hrmsMenuItems,
    ...otherMenuItems,
];
