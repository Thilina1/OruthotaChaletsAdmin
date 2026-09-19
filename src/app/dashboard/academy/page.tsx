'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Clock3,
  GraduationCap,
  MonitorPlay,
  PackageCheck,
  Search,
  ShieldCheck,
  UtensilsCrossed,
  Users,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserContext } from '@/context/user-context';
import dynamic from 'next/dynamic';
import { parseProgress, progressStorageKey } from './academy-utils';

const FeatureReference = dynamic(() => import('./feature-reference').then(module => module.FeatureReference), {
  loading: () => <p role="status" className="p-6 text-muted-foreground">Loading Feature Guide…</p>,
});

type LessonCategory = 'reception' | 'restaurant' | 'kitchen' | 'store' | 'money' | 'staff';

type Lesson = {
  id: string;
  title: string;
  summary: string;
  category: LessonCategory;
  roles: string[];
  duration: string;
  screen: string;
  screenLabel: string;
  goal: string;
  steps: string[];
  remember: string;
};

const CATEGORY = {
  reception: { label: 'Reception & Bookings', icon: Users, className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  restaurant: { label: 'Restaurant', icon: UtensilsCrossed, className: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  kitchen: { label: 'Kitchen', icon: ChefHat, className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  store: { label: 'Inventory & Stores', icon: PackageCheck, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  money: { label: 'Cash & Accounts', icon: WalletCards, className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  staff: { label: 'Staff & HR', icon: ShieldCheck, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
} as const;

const LESSONS: Lesson[] = [
  {
    id: 'front-desk-arrival',
    title: "Guest check-in කිරීම",
    summary: 'Arrival එක හඳුනාගෙන නිවැරදි room/chalet එකට check-in කරන ක්‍රමය.',
    category: 'reception', roles: ['admin', 'waiter'], duration: 'මිනිත්තු 3',
    screen: '/dashboard/front-desk', screenLabel: 'Front Desk',
    goal: 'Guestගේ booking එක හරියට හඳුනාගෙන room assignment එක තහවුරු කිරීම.',
    steps: ["Arrivals & Check-In tab එකෙන් දිනය හා guest විස්තර බලන්න.", "Guest නම, phone number සහ booking dates තහවුරු කරන්න. Room assignment අවශ්‍ය නම් අදාළ Assign Room ක්‍රියාව භාවිත කරන්න.", "Check-In form එකේ ඉල්ලා ඇති විස්තර පුරවා Complete Check-In තෝරන්න.", "Success පසු In-House Guests තුළ guest පෙනෙනවාද බලන්න. QR pass අවශ්‍ය නම් Print QR Pass භාවිත කරන්න."],
    remember: 'එකම නම තියෙන guests ඉන්න පුළුවන්. නම විතරක් බලලා record එක තෝරන්න එපා - phone number හෝ booking detailsත් ගැළපෙනවාද බලන්න.',
  },
  {
    id: 'front-desk-checkout',
    title: "Guest bill ගෙවා check-out කිරීම",
    summary: 'Room, restaurant සහ service charges එකට review කරලා checkout කරන ක්‍රමය.',
    category: 'reception', roles: ['admin', 'waiter', 'payment'], duration: 'මිනිත්තු 4',
    screen: '/dashboard/front-desk', screenLabel: 'Front Desk',
    goal: 'අදාල active stay එකේ සියලු charges settle වුණාට පස්සේ පමණක් checkout කිරීම.',
    steps: ["In-House Guests හෝ Billing & Check-Out tab එකෙන් නිවැරදි guest තෝරන්න.", "Master bill එකේ charges, කලින් ගෙවූ මුදල් සහ outstanding amount සසඳන්න.", "Outstanding මුදලක් තිබේ නම් Cash හෝ Card තෝරා ගෙවීම සටහන් කරන්න. Cash නම් ලැබුණු මුදල සහ ආපසු දෙන balance බලන්න.", "Bill සම්පූර්ණයෙන් ගෙවූ පසු පමණක් Check Out Guest & Print Invoice හෝ Confirm Check-Out ක්‍රියාව භාවිත කරන්න.", "History තුළ නිවැරදි guest record එක සහ View Bill බලන්න."],
    remember: 'Future booking එකක් හෝ වෙන guest කෙනෙක්ගේ bill එකක් close වෙන්නේ නැති බව තහවුරු කරගෙන පමණක් final action කරන්න.',
  },
  {
    id: 'restaurant-bill',
    title: "Restaurant bill confirm කර payment කිරීම",
    summary: 'Table order එක review කර cash හෝ card payment එක නිවැරදිව finish කිරීම.',
    category: 'restaurant', roles: ['admin', 'waiter', 'payment'], duration: 'මිනිත්තු 3',
    screen: '/dashboard/billing', screenLabel: 'Restaurant Billing',
    goal: 'Table එකේ final order එක සහ payment amount එක match කරලා receipt එකක් ලබාදීම.',
    steps: ["Restaurant Billing තුළ අදාළ order/table එක සොයන්න.", "Review & Confirm Bill විවෘත කර items, quantities, discount හා charges පරීක්ෂා කරන්න.", "Process Payment ක්‍රියාව සක්‍රිය වීමට අවශ්‍ය bill confirmation සහ payment request තත්ත්වය බලන්න.", "Cash හෝ Card තෝරන්න. Cash නම් Cash Received අගය පුරවා පෙන්වන payment confirmation එකෙන් ඉදිරියට යන්න.", "ගෙවීම සාර්ථක වූ පසු Print Receipt භාවිත කර Done තෝරන්න."],
    remember: 'Guestගේ room bill එකට add කළ order එකක්, cash/card ලෙස ආයෙත් charge කරන්න එපා. Payment method එක final කිරීමෙන් පස්සේ වෙනස් කිරීමට manager procedure එක භාවිත කරන්න.',
  },
  {
    id: 'kitchen-order',
    title: 'Kitchen order එක prepare කර served කිරීම',
    summary: 'Kitchen screen එකෙන් item status update කර waiterට නිවැරදි වෙලාවේ handover කිරීම.',
    category: 'kitchen', roles: ['admin', 'kitchen'], duration: 'මිනිත්තු 2',
    screen: '/dashboard/kitchen/orders', screenLabel: 'Kitchen Orders',
    goal: 'අදාළ order item එක පමණක් ready/done කිරීම සහ wrong table එකකට නොයැවීම.',
    steps: ['Kitchen Orders හි Restaurant හෝ Rooms tab එකෙන් table/room සහ order එක හඳුනා ගන්න.', 'අදාළ item එකේ Start Cooking තෝරන්න.', 'එක් portion එකක් සූදානම් වූ විට Mark 1 Ready තෝරන්න. Ready ගණන ordered quantity එකට ගැළපෙනවාද බලන්න.', 'සූදානම් ආහාර waiter වෙත භාර දෙන්න. Guestට භාරදීමේ සටහන අදාළ restaurant/front-desk workflow එකෙන් යාවත්කාලීන කෙරේ.'],
    remember: 'Order එකක් cancel හෝ edit වුණාද බලන්න. සියලු items එකවර done කරන්න එපා - සූදානම් වූ item පමණක් update කරන්න.',
  },
  {
    id: 'stock-grn',
    title: "GRN හරහා stock receive කිරීම",
    summary: 'Supplier goods ලැබුණු පසු quantity සහ warehouse එක check කරලා stock-in කිරීම.',
    category: 'store', roles: ['admin'], duration: 'මිනිත්තු 4',
    screen: '/dashboard/inventory-management/grn', screenLabel: 'GRN - Stock In',
    goal: 'අතට ලැබුණු quantity පමණක් නිවැරදි warehouse එකට stock-in කිරීම.',
    steps: ["GRN තුළ Pending Deliveries tab එකෙන් PO එක සොයා Process Receipt තෝරන්න. සෘජු stock intake සඳහා New Stock Intake (GRN) වෙනම ක්‍රියාවකි.", "Received Qty, Unit Price, Batch Number සහ අවශ්‍ය Expiry Date භාණ්ඩ සමඟ සසඳන්න.", "ලැබුණු quantity සහ පෙන්වන receive action එකේ ප්‍රමාණය හරිද බලන්න. සම්පූර්ණ තොගය නොලැබුණේ නම් සම්පූර්ණයෙන් ලැබුණු බව සටහන් නොකර store managerගෙන් ක්‍රමය තහවුරු කරගන්න.", "අදාළ receive action සම්පූර්ණ කළ පසු Received POs හෝ Stock History බලන්න.", "View Receipt සහ Print GRN මගින් receipt විස්තර පරීක්ෂා කරන්න."],
    remember: "PO quantity හා Received Qty එකම නොවිය හැක. Zero, අඩු හෝ වැඩි receipt quantity සටහන් කරන විට ක්‍රියාවේ බලපෑම store manager සමඟ තහවුරු කරන්න.",
  },
  {
    id: 'stock-issue',
    title: "Warehouse stock usage සටහන් කිරීම",
    summary: "භාවිත වූ warehouse stock quantity සහ note සටහන් කිරීම.",
    category: 'store', roles: ['admin', 'kitchen', 'waiter', 'payment'], duration: 'මිනිත්තු 3',
    screen: '/dashboard/inventory-management/stock-usage', screenLabel: 'Stock Usage',
    goal: "භාවිත වූ item, warehouse සහ quantity නිවැරදිව සටහන් කිරීම.",
    steps: ["Stock Usage තුළ warehouse එක තෝරා Available Items tab එක බලන්න.", "Search එකෙන් භාවිත කළ item එක සොයා Use තෝරන්න.", "Quantity Used සහ Notes පුරවන්න. Quantity එකේ unit එක භාවිත වූ භාණ්ඩ සමඟ සසඳන්න.", "Confirm Usage තෝරා success හෝ error ප්‍රතිචාරය බලන්න.", "Refresh කර ඉතිරි stock බලන්න. Damage/expiry සඳහා Expired / Damaged වෙනම ක්‍රියාව භාවිත කරන්න."],
    remember: 'Stock negative වෙන්න හෝ duplicate issue වෙන්න ඉඩ දෙන්න එපා. Network delay එකකදී button එක නැවත නැවත click නොකර status එක verify කරන්න.',
  },
  {
    id: 'attendance',
    title: "Clock In / Clock Out සහ attendance history",
    summary: "තමන්ගේ clock times සහ attendance history පරීක්ෂා කිරීම.",
    category: 'staff', roles: ['admin', 'waiter', 'kitchen', 'payment', 'temporary'], duration: 'මිනිත්තු 2',
    screen: '/dashboard/hrms/attendance', screenLabel: 'Attendance',
    goal: 'අද දවසේ record එක හරි date එකට submit කිරීම.',
    steps: ["Attendance තුළ අද දිනය සහ තමන්ගේ clock status එක බලන්න.", "වැඩ ආරම්භයේ Clock In සහ අවසානයේ Clock Out භාවිත කරන්න.", "My History tab එකෙන් සටහන් වූ වේලාවන් පරීක්ෂා කරන්න.", "වෙනත් සේවකයෙකු වෙනුවෙන් සටහන් කිරීමට අවසර තිබේ නම් Mark for Employee තුළ සේවකයා හා දිනය නිවැරදිව තෝරන්න."],
    remember: 'වැරදි date එකකට attendance දාන්න එපා. වැරදීමක් නම් අලුත් record එකක් දාන්නේ නැතිව managerට කියන්න.',
  },
  {
    id: 'leave-request',
    title: "Leave request යැවීම",
    summary: 'Leave dates, half-day option සහ reason එක නිවැරදිව request කිරීම.',
    category: 'staff', roles: ['admin', 'waiter', 'kitchen', 'payment'], duration: 'මිනිත්තු 2',
    screen: '/dashboard/hrms/leaves', screenLabel: 'Leave Requests',
    goal: 'Leave request එක managerට යැවීමට පෙර dates සහ leave type එක verify කිරීම.',
    steps: ["Leaves තුළ Request Leave තෝරන්න.", "Leave Type, Start Date සහ End Date තෝරන්න.", "Half Day අවශ්‍ය නම් එය සලකුණු කර Half Day Session තෝරන්න.", "Reason පුරවා Submit Request තෝරන්න.", "Request ලැයිස්තුවේ status බලන්න; submit කිරීම approval ලැබීමක් නොවේ."],
    remember: 'Half-day request එකේ morning හෝ evening session එක නිවැරදිව තෝරන්න. Date conflict එකක් තිබුණොත් manager සමඟ confirm කරන්න.',
  },
  {
    id: 'staff-access',
    title: "Staff user account සහ permissions සකස් කිරීම",
    summary: 'Role, permissions සහ password safely set කරලා account එක create කිරීම.',
    category: 'staff', roles: ['admin'], duration: 'මිනිත්තු 4',
    screen: '/dashboard/user-management', screenLabel: 'User Management',
    goal: 'වැඩට අවශ්‍ය screens පමණක් ලබා දී staff account එක safely create කිරීම.',
    steps: ["User Management තුළ Add User තෝරන්න.", "Employee Details සහ Employment & Payroll tabs වල අවශ්‍ය විස්තර සහ Role තෝරන්න.", "Security tab එකේ Password හා Confirm Password පුරවන්න; රහස්පදය අදාළ සේවකයාට පෞද්ගලිකව ලබා දෙන්න.", "Permissions tab එකෙන් අවශ්‍ය sections පමණක් තෝරා Create User කරන්න.", "Save සාර්ථක වූ බව සහ ලබා දුන් role/permissions නිවැරදි බව පරීක්ෂා කරන්න."],
    remember: 'හැම කෙනාටම admin access දෙන්න එපා. Payroll, accounts සහ staff details අවශ්‍ය අය පමණක් බලන ලෙස permissions දෙන්න.',
  },
  {
    id: 'customer-record', title: "Customer record සොයා තොරතුරු නිවැරදි කිරීම", summary: "තිබෙන customer record එකක් සොයා contact details නිවැරදි කිරීම.", category: 'reception', roles: ['admin', 'waiter'], duration: 'මිනිත්තු 2', screen: '/dashboard/customers', screenLabel: 'All Customers',
    goal: 'නිවැරදි contact details සහිත එක් customer record එකක් පවත්වා ගැනීම.',
    steps: ["All Customers තුළ name, phone හෝ ID අනුව සොයන්න.", "නිවැරදි customer record එක තහවුරු කර Edit තෝරන්න.", "Name, Phone Number, Email Address සහ අවශ්‍ය ID / Passport හෝ Address නිවැරදි කරන්න.", "Save Changes තෝරා ලැයිස්තුවේ වෙනස්කම බලන්න. මෙහි නව customer create button එකක් නැත; අදාළ booking workflow එකෙන් නව guest විස්තර ඇතුළත් කරන්න."],
    remember: "එකම නම ඇති අය හඳුනාගැනීමට phone හෝ ID සසඳන්න. වෙනත් guest කෙනෙකුගේ record එක වෙනස් නොකරන්න.",
  },
  {
    id: 'inquiry-followup', title: "Inquiry එකක් කියවා reply කිරීමට සූදානම් වීම", summary: "Guest inquiry එක කියවා Reply via Email භාවිත කරන ආකාරය.", category: 'reception', roles: ['admin'], duration: 'මිනිත්තු 3', screen: '/dashboard/inquiries', screenLabel: 'Inquiries',
    goal: "නිවැරදි inquiry එක හා contact detail හඳුනාගෙන පිළිතුර සකස් කිරීම.",
    steps: ["Inquiries තුළ name, email හෝ mobile අනුව සොයන්න.", "View මගින් inquiry එකේ විස්තර කියවන්න.", "Guestගේ අවශ්‍යතාවයට අදාළ availability සහ මිල අදාළ booking screens තුළින් තහවුරු කරන්න.", "Reply via Email මගින් පිළිතුර සකස් කරන්න. යැවීමට පෙර recipient හා විස්තර පරීක්ෂා කරන්න; මෙම screen එකේ follow-up status/note form එකක් නැත."],
    remember: 'Quote එකක් දීමට පෙර date සහ guest count නැවත අහන්න. Verbal confirmation එකක් booking confirmation එකක් නොවේ.',
  },
  {
    id: 'chalet-booking', title: "Chalet booking create හෝ edit කිරීම", summary: 'Guest dates, room සහ payment details ගැළපෙන ලෙස booking එක පවත්වා ගැනීම.', category: 'reception', roles: ['admin'], duration: 'මිනිත්තු 4', screen: '/dashboard/chalet/bookings', screenLabel: 'Chalet Bookings',
    goal: 'Double booking නැතිව stay dates සහ charges නිවැරදිව confirm කිරීම.',
    steps: ["Chalet Bookings තුළ New Booking තෝරන්න; තිබෙන booking වෙනස් කිරීමට Edit භාවිත කරන්න.", "Customer Name, Check-in Date, Check-out Date සහ contact details පුරවන්න.", "Package, Occupancy Type, Adults, Children සහ Rate Per Night පරීක්ෂා කරන්න. Assign Chalet Room අවශ්‍ය නම් තෝරන්න.", "Status, Special Requests සහ Internal Notes බලලා Create Booking හෝ Update Booking තෝරන්න.", "All Bookings ලැයිස්තුවේ සටහන බලන්න. Room එකක් පසුව ලබාදීමට Assign Room භාවිත කරන්න."],
    remember: 'Room එක availability ලෙස පෙන්වනවා කියලා rate එක හරි කියලා අදහස් නොවේ. Package, weekend සහ special rate එකත් review කරන්න.',
  },
  {
    id: 'room-and-rate', title: "Chalet room සහ package rates සකස් කිරීම", summary: 'නව chalet/room එකක් හෝ rate change එකක් safely update කිරීම.', category: 'reception', roles: ['admin'], duration: 'මිනිත්තු 3', screen: '/dashboard/chalet/rooms', screenLabel: 'Chalet Rooms',
    goal: 'Online සහ front-desk bookings දෙකටම නිවැරදි room capacity හා price යොදා තිබීම.',
    steps: ["Chalet Rooms තුළ room record එකේ Edit භාවිත කර Room Name, Room Number, Floor සහ Status බලන්න.", "Update Room මගින් අවශ්‍ය වෙනස්කම් සුරකින්න.", "Room Rates & Packages screen එකේ Rate Matrix තුළ අගයන් වෙනස් කර Save All Rates භාවිත කරන්න. මෙහි effective-date fields නැත.", "Packages tab එකේ Add Package හෝ Edit මගින් Meals Included, Additional Facilities හා Active status සකසන්න.", "මිල වෙනස් කිරීමෙන් පසු අදාළ booking එකේ පෙන්වන rate එක වෙනම තහවුරු කරන්න."],
    remember: 'Confirmed booking එකක් ඇති room එක inactive හෝ delete කරන්න එපා. Rate change එකක් future dates සඳහාද කියලා පැහැදිලිව check කරන්න.',
  },
  {
    id: 'buffet-booking', title: "Buffet booking සහ package තෝරාගැනීම", summary: "Guest details, meal type සහ buffet package එක තෝරා booking කිරීම.", category: 'restaurant', roles: ['admin'], duration: 'මිනිත්තු 3', screen: '/dashboard/buffet-bookings', screenLabel: 'Buffet Bookings',
    goal: "නිවැරදි දිනය, guest count සහ package එක booking එකට සටහන් කිරීම.",
    steps: ["Buffet Bookings තුළ New Booking තෝරන්න.", "Customer Name, Email, Phone, Date සහ Guests පුරවන්න.", "Meal Type හා Buffet Package තෝරා Comments අවශ්‍ය නම් දාන්න.", "Create Booking පසු View මගින් විස්තර බලන්න; Update status අවශ්‍ය විට භාවිත කරන්න.", "Package setup සඳහා Buffet Packages screen එකේ Add Package/Edit භාවිත කරන්න. Booking form එකේ advance payment field එකක් නැත."],
    remember: 'Estimated guest count සහ final guest count වෙනස් විය හැක. Final billing කිරීමට පෙර current count එක confirm කරන්න.',
  },
  {
    id: 'menu-and-table-setup', title: "Menu items, sections සහ tables සකස් කිරීම", summary: 'Restaurant menu, price, availability සහ table layout නිවැරදිව පවත්වා ගැනීම.', category: 'restaurant', roles: ['admin'], duration: 'මිනිත්තු 4', screen: '/dashboard/menu-management', screenLabel: 'Menu Management',
    goal: 'POS එකේ correct items සහ prices පමණක් staffට පෙනීම.',
    steps: ["Menu Section Settings තුළ Add Section මගින් category එක සකස් කරන්න.", "Menu Management තුළ Add Menu Item තෝරා Stock Type, Name, Menu Section, Selling Price සහ Available for Sale සකසන්න.", "Inventoried item නම් inventory item සහ unit විස්තරත් පරීක්ෂා කර Create Item හෝ Update Item තෝරන්න.", "Table Management තුළ Add Table හෝ Edit මගින් Table Number, Section, Capacity සහ Status සකසන්න.", "Restaurant order screen එකේ පෙන්වන menu item සහ table විස්තර පරීක්ෂා කරන්න."],
    remember: 'Price වෙනස් කළ පසු live order එකක total එක බලන්න. Menu item එක delete කරනවාට වඩා unavailable ලෙස mark කිරීම history සඳහා ආරක්ෂිතයි.',
  },
  {
    id: 'restaurant-close', title: "Restaurant cash සහ card collection account බලන්න", summary: "Restaurant collections, card destination සහ cash transfer සටහන් බලන්න.", category: 'money', roles: ['admin', 'payment'], duration: 'මිනිත්තු 3', screen: '/dashboard/restaurant-account', screenLabel: 'Restaurant Account',
    goal: "Collection මුදල් සහ destination account නිවැරදිව සසඳන්න.",
    steps: ["Restaurant Account තුළ collection සාරාංශය බලලා Refresh කරන්න.", "Card collection යැවිය යුතු account එක අවශ්‍ය නම් තෝරා Save Card Account භාවිත කරන්න.", "Cash transfer එකක් සටහන් කිරීමට Transfer to Account තුළ Destination account, Amount සහ Notes පුරවන්න.", "අනුමත මුදල හා account එක පරීක්ෂා කර Confirm Transfer කරන්න.", "Daily sales විශ්ලේෂණය සඳහා Restaurant Analytics වෙනම screen එක භාවිත කරන්න."],
    remember: 'Sales total එක cash total එක නොවෙයි. Card, room charge සහ pending amounts වෙන්ව බලන්න.',
  },
  {
    id: 'kitchen-stock-request', title: "Kitchen stock request සහ usage", summary: 'අවශ්‍ය ingredients request කර usage හා damage නිවැරදිව දාන්න.', category: 'kitchen', roles: ['admin', 'kitchen'], duration: 'මිනිත්තු 3', screen: '/dashboard/kitchen/inventory-requests', screenLabel: 'Kitchen Stock Request',
    goal: 'Kitchenට ලැබුණු සහ භාවිත වූ stock සඳහා traceable record එකක් තබා ගැනීම.',
    steps: ["Kitchen Stock Request තුළ Request & Assign Items තෝරා Active Department පරීක්ෂා කරන්න.", "Find Items තුළ item සොයා Request Stock තෝරන්න.", "Source Warehouse, Requested Quantity හා Reason / Notes පුරවා request එක යවන්න.", "View History තුළ request ප්‍රගතිය බලන්න.", "භාවිතය සටහන් කිරීමට Mark Stock Usage තුළ warehouse හා item තෝරා Use සහ Confirm Usage භාවිත කරන්න."],
    remember: 'Damage එක usage ලෙස දාන්න එපා. Damage reason එක සහ quantity වෙනම record කිරීම stock variance හඳුනාගැනීමට අවශ්‍යයි.',
  },
  {
    id: 'kitchen-event-food', title: 'Event food requirements සකස් කරන්න', summary: 'Event booking එක අනුව kitchen preparation list එක check කිරීම.', category: 'kitchen', roles: ['admin', 'kitchen'], duration: 'මිනිත්තු 3', screen: '/dashboard/kitchen/events', screenLabel: 'Event Food Requirements',
    goal: 'Event date, pax count හා menu එකට ගැළපෙන food requirement එක සකස් කිරීම.',
    steps: ["Kitchen Events තුළ Active හෝ Completed list එක තෝරන්න.", "අදාළ event එකේ View Details විවෘත කරන්න.", "Event date, guest count සහ food requirements දක්වා ඇති විස්තර බලන්න.", "වෙනස්කමක් හෝ අඩුවක් තිබේ නම් event coordinatorගෙන් තහවුරු කර අදාළ stock request workflow එක භාවිත කරන්න."],
    remember: 'Event date එකට පෙර final pax count confirm කරන්න. Assumed count එකෙන් food prepare කිරීම waste වැඩි කරයි.',
  },
  {
    id: 'inventory-master-data', title: "Store සහ inventory item setup", summary: 'Warehouse, item unit සහ minimum stock details නිවැරදිව setup කිරීම.', category: 'store', roles: ['admin'], duration: 'මිනිත්තු 4', screen: '/dashboard/inventory-management', screenLabel: 'Manage Items',
    goal: 'එකම item එකට නිවැරදි unit, store සහ stock history එකක් තිබීම.',
    steps: ["Manage Store තුළ Store Name, Location / Description සහ Link to Department අවශ්‍ය ලෙස සකසන්න.", "Add New Item හි New Item තෝරා Item Name, Size Attribute, Category, SKU, Initial Status සහ Brand පුරවන්න.", "Duplicate Detected පණිවුඩයක් තිබේ නම් තිබෙන item එක සොයන්න. නිවැරදි නම් Confirm Registration භාවිත කරන්න.", "Unit හා warehouse stock සැකසුම් අදාළ Manage Items/stock workflow එකේ සසඳන්න; item registration එක stock receive කිරීමක් නොවේ."],
    remember: '“kg”, “g”, “packet” වගේ units mix කරලා එකම item එක දාන්න එපා. Unit වරදක් stock valuation සහ usage reports දෙකම වැරදි කරයි.',
  },
  {
    id: 'mrn-and-po', title: "Stock request සහ Purchase Order review", summary: 'Department අවශ්‍යතාවයක් purchase workflow එකෙන් approve කර supplierට යැවීම.', category: 'store', roles: ['admin'], duration: 'මිනිත්තු 5', screen: '/dashboard/inventory-requests', screenLabel: 'MRN Requests',
    goal: 'Requested item, quantity හා approval එකෙන් පසු පමණක් PO එකක් නිර්මාණය කිරීම.',
    steps: ["MRN Requests තුළ Active Department සහ item තෝරා Request Stock කරන්න.", "Source Warehouse හා Requested Quantity පුරවා View History තුළ status බලන්න.", "Purchase Orders තුළ නව PO සකස් කරන විට Order Type, Supplier Name සහ Order Items දාන්න.", "PO Approvals තුළ Review කර අවශ්‍ය නම් Edit PO Before Approval භාවිත කරන්න.", "අනුමත කිරීමට Authorized & Approve PO හෝ ප්‍රතික්ෂේප කිරීමට Reject & Return to Draft භාවිත කරන්න."],
    remember: 'MRN approval නැති request එකකට PO එකක් හදන්න එපා. Supplier price එක පෙර PO හෝ quotation එකට ගැළපෙනවාද check කරන්න.',
  },
  {
    id: 'inventory-controls', title: "Expired / damaged stock report process කිරීම", summary: 'Stock issue, expiry, damage සහ audit trail එකෙන් inventory control කිරීම.', category: 'store', roles: ['admin'], duration: 'මිනිත්තු 4', screen: '/dashboard/inventory-management/expired-damaged', screenLabel: 'Expired & Damaged',
    goal: 'Unusable stock වෙනම record කර stock reports විශ්වාසදායකව තබා ගැනීම.',
    steps: ["Stock Usage තුළ Expired / Damaged ක්‍රියාවෙන් quantity, report type හා reason සටහන් කරන්න.", "Expired & Damaged screen එකේ warehouse, type, status හා date filters යොදා report එක සොයන්න.", "Process විවෘත කර Unit Value, Action Taken සහ Notes බලන්න.", "Write Off හෝ Return Items අතර අදාළ ක්‍රියාව තෝරන්න. Restore stock quantity තෝරන්නේ සැබවින්ම භාවිතයට ආපසු ගන්නා තොගයට පමණි.", "ප්‍රතිඵලය Transaction Log සහ Stock Overview සමඟ පරීක්ෂා කරන්න."],
    remember: 'Expired/damaged stock නැවත usable stock ලෙස issue කරන්න එපා. Report එකක් බලලා transaction එක delete කිරීමට පෙර cause එක හඳුනා ගන්න.',
  },
  {
    id: 'inventory-cash', title: "Inventory cash request සහ settlement", summary: 'Urgent purchase cash එක request, approve සහ account කිරීම.', category: 'money', roles: ['admin', 'payment'], duration: 'මිනිත්තු 3', screen: '/dashboard/inventory-cash-requests', screenLabel: 'Cash Requests',
    goal: 'Cash request එකේ amount, purpose හා approval trail එක පැහැදිලිව තබා ගැනීම.',
    steps: ["Cash Requests තුළ New Request තෝරා Purpose හා Requested Amount පුරවන්න; PO link එක optional ය.", "Submit Request පසු approval status බලන්න.", "Cash and Credit Approvals තුළ approverට Approve Request හෝ Reject Request සහ reason සටහන් කළ හැක.", "වියදම අවසන් වූ පසු Settle තුළ Amount Spent දාන්න. වැඩිපුර වියදම් නම් Reason for Overspend පුරවන්න.", "Submit Settlement හෝ පෙන්වන additional request action පසු status හා ඉතිරි මුදල් පරීක්ෂා කරන්න."],
    remember: 'Receipt නැති expense එකක් close කරන්න එපා. Requested amount සහ actual spending වෙනස note කරන්න.',
  },
  {
    id: 'accounts-daily-work', title: "Account setup සහ මුදල් සටහන්", summary: "Accounts, deposits, withdrawals සහ transaction filters භාවිත කිරීම.", category: 'money', roles: ['admin', 'payment'], duration: 'මිනිත්තු 4', screen: '/dashboard/accounting', screenLabel: 'Accounting',
    goal: 'සියලු cash movements source document එකට ගැළපෙන ලෙස accounts වල තිබීම.',
    steps: ["Accounting තුළ Accounts tab එකෙන් New Account හෝ Edit තෝරන්න.", "Account Name, Type, Account Number සහ Opening Balance පරීක්ෂා කරන්න.", "මුදල් සටහනක් සඳහා අදාළ account එකේ Deposit හෝ Withdraw විවෘත කරන්න.", "Amount, Date, Description සහ Reference පුරවන්න; account එක හා මුදල තහවුරු කර සුරකින්න.", "From/To සහ Apply යොදා Overview, Income, Expenses හෝ All Transactions බලන්න."],
    remember: 'Income එක expense ලෙස හෝ expense එක income ලෙස දාන්න එපා. Month-end පසු entry date වෙනස් කිරීමෙන් report වෙනස් විය හැක.',
  },
  {
    id: 'service-income', title: "Service charges සහ collections බලන්න", summary: "Service charge එක guest bill එකට එකතු කිරීම සහ ලැබුණු payments සටහන් කිරීම.", category: 'money', roles: ['admin'], duration: 'මිනිත්තු 3', screen: '/dashboard/services/account', screenLabel: 'Services Account',
    goal: 'Service charge එක customer/service/date සමඟ නිවැරදිව account කිරීම.',
    steps: ["Laundry, Transport හෝ Spa/Pool income screen එකේ Add Record තෝරන්න.", "Date, Line Items, Customer හා Room Number අවශ්‍ය ලෙස පුරවන්න.", "Guest master bill එකට එක් කිරීමට Save (Add to Bill) භාවිත කරන්න. දැනට මුදල් ලැබී තිබේ නම් payment method තෝරා Save as Paid & Print භාවිත කරන්න.", "ගෙවූ records edit කිරීම සීමා කර තිබිය හැකි නිසා save කිරීමට පෙර විස්තර බලන්න.", "Services Account යනු collection/transfer සාරාංශයයි; එහි customer service record create form එකක් නැත."],
    remember: 'Room bill එකට add කළ service එක cash entry එකක් ලෙස නැවත දාන්න එපා. Service date සහ guest name check කරන්න.',
  },
  {
    id: 'event-workspace', title: "Event workspace භාවිත කිරීම", summary: 'Event workspace, calendar, registration සහ approvals එකට manage කිරීම.', category: 'reception', roles: ['admin'], duration: 'මිනිත්තු 5', screen: '/dashboard/event-management/events', screenLabel: 'Event Workspace',
    goal: 'Event date, customer, budget, registrations හා operational requirements එක තැනක නිවැරදිව තබා ගැනීම.',
    steps: ["Event Workspace තුළ Create event හෝ තිබෙන event එක තෝරන්න.", "Event form එකේ පෙන්වන විස්තර සකසා Save කරන්න.", "Schedule, Food, Activities, Budget සහ Workflow tabs තුළ අදාළ සැලසුම් බලන්න.", "අනුමත කිරීම අවශ්‍ය නම් approverගේ Approve Event හෝ Reject Event ක්‍රියාව සහ comment භාවිත කරන්න.", "Payments tab සහ Add payment භාවිත කරන්නේ event, amount හා ගෙවීම තහවුරු කරගත් පසුවය."],
    remember: 'Event approval ලැබීමට පෙර supplier commitment හෝ final expense confirm කරන්න එපා. Pax count change එක kitchen හා billing teamට දැනුම් දෙන්න.',
  },
  {
    id: 'employee-profile', title: "Employee record හා calendar බලන්න", summary: 'Staff details, job title හා employment status නිවැරදිව පවත්වා ගැනීම.', category: 'staff', roles: ['admin'], duration: 'මිනිත්තු 4', screen: '/dashboard/hrms/employees', screenLabel: 'Employees',
    goal: 'Payroll, attendance හා approvals සඳහා active staff data විශ්වාසදායකව තබා ගැනීම.',
    steps: ["Employees තුළ Add Employee හෝ තිබෙන සේවකයාගේ Edit තෝරන්න.", "Personal සහ employment විස්තර form එකට අනුව පුරවා සුරකින්න.", "Show all / Hide without salary මගින් ලැයිස්තුවේ පෙන්වන සේවකයන් පාලනය කරන්න.", "Calendar මගින් Personal Holidays සහ Common Calendar බලන්න; වෙනස්කම් කිරීමට පෙර සේවකයා හා දිනය තහවුරු කරන්න."],
    remember: 'Exit වූ staffගේ record delete කරන්න එපා. Active status සහ access disable කිරීම history රැකගැනීමට වඩා හොඳයි.',
  },
  {
    id: 'leave-and-ot-approvals', title: "Manager leave approval review කිරීම", summary: "Leave request එකක් review කර HR වෙත forward කිරීම හෝ reject කිරීම.", category: 'staff', roles: ['admin', 'waiter', 'kitchen', 'payment'], duration: 'මිනිත්තු 3', screen: '/dashboard/hrms/manager-leave-approvals', screenLabel: 'Manager Leave Approvals',
    goal: 'Roster සහ leave balance සලකා approval/rejection එක පැහැදිලිව තැබීම.',
    steps: ["Manager Leave Approvals තුළ අදාළ සේවකයාගේ request එක හඳුනා ගන්න.", "Dates, leave type, reason හා team coverage සසඳන්න.", "Approve හෝ Reject තෝරා පෙන්වන confirmation එක කියවන්න.", "Approve & Forward to HR යනු HR වෙත යැවීමයි; අවසාන අනුමැතිය ලැබී ඇති බව වෙනම status එකෙන් බලන්න."],
    remember: 'Staff memberට verbally yes කිව්වත් system status update නොකළොත් payroll හා roster records වැරදියි.',
  },
  {
    id: 'payroll-and-payslip', title: "Payroll සහ summary review කිරීම", summary: 'Attendance, allowances, deductions සහ payroll summary review කිරීම.', category: 'staff', roles: ['admin'], duration: 'මිනිත්තු 5', screen: '/dashboard/hrms/payroll', screenLabel: 'Payroll',
    goal: 'Payroll finalize කිරීමට පෙර staff hours, OT සහ deductions සත්‍යාපනය කිරීම.',
    steps: ["Payroll තුළ Year සහ Pay Period පරීක්ෂා කරන්න.", "Salary Configuration යටතේ අදාළ සේවකයාගේ salary සැකසුම් බලන්න; Configure salary first පෙන්වන්නේ නම් එය සකසන්න.", "Attendance, අනුමත leave හා salary අගයන් පරීක්ෂා කර අනුමත payroll period එකට Run Payroll භාවිත කරන්න.", "Payroll Summary තුළ ප්‍රතිඵල සසඳා අවශ්‍ය නම් Export Excel භාවිත කරන්න.", "Payslip screen එකේ අදාළ මාසය හා මුදල් වෙනම පරීක්ෂා කරන්න; Payroll Summary හි approval button එකක් නැත."],
    remember: 'Payroll finalize කළ පසු correcting entry වල trail එක අවශ්‍යයි. Missing attendance එකක් තිබේ නම් guess කරන්න එපා.',
  },
  {
    id: 'daily-workers-petty-cash', title: "Daily workers, roster සහ pay status", summary: "Daily worker විස්තර, daily roster සහ pay status පරීක්ෂා කිරීම.", category: 'staff', roles: ['admin', 'payment'], duration: 'මිනිත්තු 4', screen: '/dashboard/hrms/daily-workers', screenLabel: 'Daily Workers',
    goal: "නිවැරදි දවසේ සේවකයන් හා rate අනුව attendance/pay සටහන් තබා ගැනීම.",
    steps: ["Daily Workers හි Manage Workers තුළ Add Worker මගින් නම, department හා Daily Rate ඇතුළත් කරන්න.", "Attendance & Pay තුළ Work Date සහ Employee තෝරා Save Daily Roster භාවිත කරන්න.", "අදාළ දිනයේ Full, Half හෝ Absent තත්ත්වය නිවැරදිව සටහන් කරන්න.", "Money Requests මගින් අවශ්‍ය මුදල request කර approval/issue තත්ත්වය බලන්න.", "Pay All Unpaid යනු මුදල් සටහන් කරන ක්‍රියාවක් නිසා දවසේ සේවකයන් සහ මුළු මුදල තහවුරු කරගත් පසුව පමණක් භාවිත කරන්න."],
    remember: "Pay All Unpaid තෝරන්න පෙර දිනය, Full/Half status සහ මුළු මුදල සසඳන්න. මුදල් සටහනක් නැවත නොදමන්න.",
  },
  {
    id: 'roles-and-profile', title: "Role permissions සහ profile review", summary: "Role sections සකස් කිරීම සහ staff profile තොරතුරු කියවීම.", category: 'staff', roles: ['admin'], duration: 'මිනිත්තු 3', screen: '/dashboard/settings/roles', screenLabel: 'Role Permissions',
    goal: 'Operational security රැකගෙන correct role access පවත්වා ගැනීම.',
    steps: ["Role Permissions තුළ අදාළ role එක තෝරන්න හෝ New Role මගින් role එකක් සකසන්න.", "අවශ්‍ය sections පමණක් තෝරා Save කරන්න; role වෙනස් කිරීම එම role භාවිත කරන අයට බලපායි.", "User Management තුළ එක් එක් සේවකයාගේ role සහ permissions පරීක්ෂා කරන්න.", "Profile screen එකෙන් විස්තර බලන්න. වැරදි තොරතුරක් නම් administratorට දන්වන්න; එහි password/edit form එකක් නැත."],
    remember: 'Password share කරන්න එපා. Shared account එකක් තිබුණොත් කවුද action එක කළේ කියලා audit trail එකෙන් හඳුනාගන්න බැහැ.',
  },
  {
    id: 'reports-and-content', title: "Restaurant Analytics සහ reports බලන්න", summary: "Restaurant sales කාල පරාසය සහ management report destinations පරීක්ෂා කිරීම.", category: 'money', roles: ['admin', 'payment'], duration: 'මිනිත්තු 3', screen: '/dashboard/restaurant-analytics', screenLabel: 'Restaurant Analytics',
    goal: 'Decision ගැනීමට පෙර correct date range සහ source data එකෙන් report බලීම.',
    steps: ["Restaurant Analytics තුළ අවශ්‍ය කාල පරාසය තෝරන්න.", "Revenue, orders, average order value සහ පෙන්වන charts සසඳන්න.", "Inventory හෝ HR reports සඳහා අදාළ module එකේ report screen භාවිත කරන්න.", "සාමාන්‍ය Reports screen එක දැනට Under Migration නිසා එහි reports භාවිත කළ නොහැක."],
    remember: 'Report එකේ date filter එක check නොකර total share කරන්න එපා. Public website content change එකක් publish කිරීමට පෙර preview කරන්න.',
  },
];

export default function AcademyPage() {
  const { user, hasPathAccess } = useUserContext();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LessonCategory | 'all'>('all');
  const [mode, setMode] = useState<'learn' | 'reference'>('learn');
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [progressOwner, setProgressOwner] = useState<string | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const currentCompleted = progressOwner === user?.id ? completed : [];

  useEffect(() => {
    setCompleted([]);
    setProgressOwner(null);
    if (!user?.id) return;
    try {
      const saved = window.localStorage.getItem(progressStorageKey(user.id));
      setCompleted(parseProgress(saved, LESSONS.map(lesson => lesson.id)));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
    setProgressOwner(user.id);
  }, [user?.id]);

  const visibleLessons = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return LESSONS.filter(lesson => {
      const matchesCategory = category === 'all' || lesson.category === category;
      const searchable = `${lesson.title} ${lesson.summary} ${lesson.screenLabel} ${lesson.steps.join(' ')} ${CATEGORY[lesson.category].label}`.toLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query]);

  const progress = Math.round(currentCompleted.length / LESSONS.length * 100);

  const canOpenScreen = (lesson: Lesson) => {
    if (user?.role === 'admin' && !user.restrict_admin_permissions) return true;
    return hasPathAccess(lesson.screen);
  };

  const toggleCompleted = (lessonId: string) => {
    if (!user?.id || progressOwner !== user.id) return;
    const next = currentCompleted.includes(lessonId) ? currentCompleted.filter(id => id !== lessonId) : [...currentCompleted, lessonId];
    setCompleted(next);
    try {
      window.localStorage.setItem(progressStorageKey(user.id), JSON.stringify(next));
      setStorageUnavailable(false);
    } catch { setStorageUnavailable(true); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-amber-500/10 p-5 shadow-sm sm:p-7">
        <div className="absolute -right-14 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary"><GraduationCap className="size-5" /><span className="text-xs font-bold uppercase tracking-[0.18em]">Oruthota Academy</span></div>
            <h1 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">අද අලුත් දෙයක් ඉගෙන ගනිමු.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">ඔබට අවශ්‍ය වැඩේ තෝරන්න. කෙටි සිංහල පාඩමක් සමඟ ඔබේම වේගයෙන් ඉගෙන ගන්න.</p>
          </div>
          <Card className="border-primary/15 bg-background/75 shadow-sm backdrop-blur-sm"><CardContent className="p-4"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Your Progress</span><span className="text-sm font-bold text-primary">{progress}%</span></div><Progress value={progress} className="h-2" /><p className="mt-2 text-xs text-muted-foreground">{currentCompleted.length} / {LESSONS.length} lessons · {storageUnavailable ? 'මේ වාරයේ පමණක් සටහන් වේ; browser storage භාවිත කළ නොහැක.' : 'ඔබගේ account එක සඳහා මේ browser එකේ සුරැකේ.'}</p></CardContent></Card>
        </div>
      </section>

      <div className="inline-flex max-w-full gap-1 rounded-2xl border bg-muted/40 p-1.5" role="group" aria-label="පුහුණු ආකාරය">
        <Button className="h-auto whitespace-normal rounded-xl px-5 py-3" variant={mode === 'learn' ? 'default' : 'ghost'} onClick={() => setMode('learn')} aria-pressed={mode === 'learn'}><BookOpen className="mr-2 size-4" />Learn a Workflow</Button>
        <Button className="h-auto whitespace-normal rounded-xl px-5 py-3" variant={mode === 'reference' ? 'default' : 'ghost'} onClick={() => setMode('reference')} aria-pressed={mode === 'reference'}><Search className="mr-2 size-4" />Feature Guide</Button>
      </div>
      {mode === 'reference' ? <FeatureReference /> : <>
      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">Explore Departments</h2><p className="mt-1 text-sm text-muted-foreground">අංශයක් තෝරා එයට අදාළ පාඩම් බලන්න.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CATEGORY) as LessonCategory[]).map(key => { const meta = CATEGORY[key]; const Icon = meta.icon; return <button key={key} type="button" aria-pressed={category === key} onClick={() => {setCategory(category === key ? 'all' : key); setExpanded(false);}} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${category === key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card hover:border-primary/40 hover:bg-muted/30'}`}><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.className}`}><Icon className="size-5" /></span><span className="text-sm font-semibold leading-6">{meta.label}</span></button>; })}
        </div>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold">{category === 'all' ? 'ඔබට පටන් ගන්න පුළුවන් මෙතැනින්' : CATEGORY[category].label}</h2><p className="mt-1 text-sm text-muted-foreground">එක් පාඩමකට මිනිත්තු කිහිපයක් පමණයි.</p></div>
        <div className="relative sm:w-72"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="පාඩම් සොයන්න" className="rounded-xl pl-10" value={query} onChange={e => {setQuery(e.target.value); setExpanded(false);}} placeholder="ඔබට ඉගෙන ගන්න අවශ්‍ය වැඩේ…" /></div>
      </div>
      {category !== 'all' && <Button variant="ghost" size="sm" onClick={() => setCategory('all')}>← All Departments</Button>}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(expanded || query || category !== 'all' ? visibleLessons : visibleLessons.slice(0, 6)).map(lesson => {
          const meta = CATEGORY[lesson.category];
          const Icon = meta.icon;
          const isDone = currentCompleted.includes(lesson.id);
          return <Card key={lesson.id} className="group flex min-h-[260px] flex-col overflow-hidden border transition-shadow hover:shadow-md">
            <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className={`flex size-10 items-center justify-center rounded-xl ${meta.className}`}><Icon className="size-5" /></div>{isDone && <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="size-3" /> Completed</Badge>}</div><CardTitle className="pt-3 text-lg leading-snug">{lesson.title}</CardTitle><CardDescription className="leading-5">{lesson.summary}</CardDescription></CardHeader>
            <CardContent className="mt-auto space-y-3"><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{lesson.duration}</span><span className="inline-flex items-center gap-1"><MonitorPlay className="size-3.5" />{lesson.screenLabel}</span></div><Button className="w-full justify-between rounded-xl" variant="outline" onClick={() => setSelected(lesson)}>View Lesson <ArrowRight className="size-4" /></Button></CardContent>
          </Card>;
        })}
      </section>

      {visibleLessons.length === 0 && <Card className="border-dashed"><CardContent className="py-14 text-center"><BookOpen className="mx-auto mb-3 size-9 text-muted-foreground" /><h2 className="font-semibold">No lessons found</h2><p className="mt-1 text-sm text-muted-foreground">සෙවුම හිස් කරන්න හෝ වෙනත් අංශයක් තෝරන්න.</p><Button className="mt-4" variant="outline" onClick={() => {setQuery(''); setCategory('all');}}>Clear Filters</Button></CardContent></Card>}

      {!expanded && !query && category === 'all' && visibleLessons.length > 6 && <div className="text-center"><Button variant="outline" className="rounded-xl" onClick={() => setExpanded(true)}>More Lessons ({visibleLessons.length - 6}) <ArrowRight className="ml-2 size-4" /></Button></div>}
      </>}

      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto p-0">
          {selected && <>
            <DialogHeader className="border-b bg-muted/30 px-6 py-5 pr-12"><div className="mb-2 flex items-center gap-2"><Badge variant="secondary">{CATEGORY[selected.category].label}</Badge><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{selected.duration}</span></div><DialogTitle className="text-xl leading-snug">{selected.title}</DialogTitle><DialogDescription className="pt-1">අරමුණ: {selected.goal}</DialogDescription></DialogHeader>
            <div className="space-y-5 px-6 py-5"><div className="rounded-xl border border-primary/15 bg-primary/5 p-4"><p className="text-sm font-semibold text-primary">මේ පාඩම කරන විදිහ</p><p className="mt-1 text-sm text-muted-foreground">පියවර එකක් කියවලා, අදාළ screen එකට ගිහින් ඒක කරලා, පස්සේ ඊළඟ පියවරට යන්න.</p></div><ol className="space-y-3">{selected.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><p className="pt-1 text-sm leading-6">{step}</p></li>)}</ol><div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="text-sm font-semibold text-amber-950 dark:text-amber-100">මතක තබාගන්න</p><p className="mt-1 text-sm leading-6 text-amber-950/85 dark:text-amber-100/85">{selected.remember}</p></div></div><div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-between"><Button type="button" variant={currentCompleted.includes(selected.id) ? 'secondary' : 'default'} onClick={() => toggleCompleted(selected.id)}><CheckCircle2 className="size-4" />{currentCompleted.includes(selected.id) ? 'Mark as Incomplete' : 'Mark as Complete'}</Button>{canOpenScreen(selected) ? <Button asChild variant="outline"><Link href={selected.screen}>Open Screen <ArrowRight className="size-4" /></Link></Button> : <p className="self-center text-xs text-muted-foreground">මෙම screen එක ඔබගේ account එකට දීලා නැහැ.</p>}</div></div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
