'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, BedDouble, Bell, CalendarCheck, ChefHat, CheckCheck, CreditCard, MessageSquare, ReceiptText, ShoppingCart, Utensils } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/context/user-context';

type Notification = {
    id: string;
    title: string;
    message: string;
    href: string | null;
    type: string;
    read_at: string | null;
    created_at: string;
};

export function NotificationMenu() {
    const router = useRouter();
    const { user } = useUserContext();
    const supabase = useMemo(() => createClient(), []);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const unreadCount = notifications.filter(item => !item.read_at).length;

    const loadNotifications = useCallback(async () => {
        const response = await fetch('/api/notifications', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        setNotifications(data.notifications ?? []);
    }, []);

    useEffect(() => {
        void loadNotifications();
        const interval = window.setInterval(() => void loadNotifications(), 30_000);
        const handleNotificationsChanged = () => void loadNotifications();
        window.addEventListener('notifications-changed', handleNotificationsChanged);

        const channel = user?.id
            ? supabase
                .channel(`notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => void loadNotifications()
                )
                .subscribe()
            : null;

        return () => {
            window.clearInterval(interval);
            window.removeEventListener('notifications-changed', handleNotificationsChanged);
            if (channel) void supabase.removeChannel(channel);
        };
    }, [loadNotifications, supabase, user?.id]);

    const markRead = async (notification: Notification) => {
        const destination = notification.type === 'event_approval'
            ? '/dashboard/event-management/approvals'
            : notification.href;

        if (['purchase_order_approval', 'chalet_booking', 'buffet_booking', 'general_inquiry', 'inventory_cash_issuance', 'leave_approval', 'event_approval', 'kitchen_order', 'restaurant_billing', 'confirmed_restaurant_bill'].includes(notification.type)) {
            if (destination) router.push(destination);
            return;
        }

        if (!notification.read_at) {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: notification.id }),
            });
            setNotifications(current => current.map(item =>
                item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
            ));
        }
        if (destination) router.push(destination);
    };

    const markAllRead = async () => {
        await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mark_all: true }),
        });
        setNotifications(current => current.map(item =>
            ['purchase_order_approval', 'chalet_booking', 'buffet_booking', 'general_inquiry', 'inventory_cash_issuance', 'leave_approval', 'event_approval', 'kitchen_order', 'restaurant_billing', 'confirmed_restaurant_bill'].includes(item.type)
                ? item
                : { ...item, read_at: item.read_at ?? new Date().toISOString() }
        ));
    };

    return (
        <DropdownMenu onOpenChange={open => open && void loadNotifications()}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-96 max-w-[calc(100vw-2rem)] !bg-background border-border shadow-2xl"
            >
                <div className="flex items-center justify-between px-2 py-1.5">
                    <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={event => {
                            event.preventDefault();
                            void markAllRead();
                        }}>
                            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
                ) : notifications.map(notification => (
                    <DropdownMenuItem
                        key={notification.id}
                        className={`items-start gap-3 p-3 cursor-pointer ${notification.read_at ? '' : 'bg-primary/5'}`}
                        onSelect={() => void markRead(notification)}
                    >
                        {notification.type === 'chalet_booking' ? (
                            <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'buffet_booking' ? (
                            <Utensils className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'general_inquiry' ? (
                            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'inventory_cash_issuance' ? (
                            <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'leave_approval' || notification.type === 'event_approval' ? (
                            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'kitchen_order' ? (
                            <ChefHat className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'restaurant_billing' ? (
                            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : notification.type === 'confirmed_restaurant_bill' ? (
                            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                            <ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{notification.title}</p>
                                {!notification.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal">{notification.message}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </p>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
