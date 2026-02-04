
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Eye, CircleSlash } from "lucide-react";
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PaymentModal } from '@/components/dashboard/billing/payment-modal';

const statusColors: Record<string, string> = {
    'billed': 'bg-orange-500 text-white',
    'closed': 'bg-green-500 text-white',
};

export default function PaymentDashboard() {
    const supabase = createClient();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'billed')
                .order('created_at', { ascending: false });

            if (data) setOrders(data as any);
            setIsLoading(false);
        };

        fetchOrders();

        const channel = supabase.channel('payment-dashboard-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleViewBill = (order: Order) => {
        setSelectedOrder(order);
    };

    const handleCloseModal = () => {
        setSelectedOrder(null);
    };

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Payment Dashboard</h1>
                    <p className="text-muted-foreground">Track and manage all unpaid bills.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard />
                            Pending Bills
                        </CardTitle>
                        <CardDescription>A list of all bills that are waiting for payment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Table No.</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))}
                                {!isLoading && orders && orders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.table_number}</TableCell>
                                        <TableCell>LKR {order.total_price.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Badge className={`capitalize ${statusColors[order.status] || 'bg-gray-500'}`}>
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleViewBill(order)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Process Payment
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!isLoading && (!orders || orders.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <CircleSlash className="h-10 w-10" />
                                                <p>No pending bills found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {selectedOrder && (
                <PaymentModal
                    order={selectedOrder}
                    isOpen={!!selectedOrder}
                    onClose={handleCloseModal}
                />
            )}
        </>
    );
}
