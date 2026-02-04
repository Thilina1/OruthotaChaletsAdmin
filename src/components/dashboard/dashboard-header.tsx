
'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { User, LogOut } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUserContext } from '@/context/user-context';
import { SidebarTrigger } from '../ui/sidebar';

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case '/dashboard':
      return 'Dashboard';
    case '/dashboard/profile':
      return 'Profile';
    case '/dashboard/user-management':
      return 'User Management';
    case '/dashboard/menu-management':
      return 'Menu Management';
    case '/dashboard/table-management':
      return 'Table Management';
    case '/dashboard/inventory-management':
      return 'Inventory Management';
    case '/dashboard/billing':
      return 'Restaurant Billing';
    case '/dashboard/reports':
      return 'Reports';
    case '/dashboard/reservations':
      return 'Reservation Management';
    case '/dashboard/room-management':
      return 'Room Management';
    case '/dashboard/activities':
      return 'Activity Management';
    case '/dashboard/experiences':
      return 'Experience Management';
    case '/dashboard/blogs':
      return 'Blog Management';
    case '/dashboard/blogs/create':
      return 'Create Blog Post';
    default:
      if (pathname.startsWith('/dashboard/tables/')) {
        return 'Table Order';
      }
      if (pathname.startsWith('/dashboard/blogs/edit/')) {
        return 'Edit Blog Post';
      }
      return 'Dashboard';
  }
}

export default function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUserContext();
  const avatar = PlaceHolderImages.find(p => p.id === 'avatar-2');
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="sm:hidden" />
      </div>
      <div className="flex-1">
        <h1 className="font-semibold text-lg">{getPageTitle(pathname)}</h1>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Avatar>
              {avatar && <AvatarImage src={avatar.imageUrl} alt={user?.name || 'User'} />}
              <AvatarFallback>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
