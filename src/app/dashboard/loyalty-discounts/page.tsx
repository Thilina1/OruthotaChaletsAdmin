'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LoyaltyDiscount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AddLoyaltyDiscount } from './components/add-loyalty-discount';
import { EditLoyaltyDiscount } from './components/edit-loyalty-discount';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function LoyaltyDiscountsPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const [discounts, setDiscounts] = useState<LoyaltyDiscount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDiscounts = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('loyalty_discounts').select('*').order('points_required', { ascending: true });
        if (error) {
            console.error("Error fetching discounts:", error);
            setError(error.message);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch loyalty discounts." });
        } else {
            setDiscounts(data as LoyaltyDiscount[]);
            setError(null);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchDiscounts();

        const channel = supabase.channel('loyalty-discounts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_discounts' }, () => {
                fetchDiscounts();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const refreshData = () => {
        fetchDiscounts();
    };

    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(discounts || [], 20);

    return (
        <div className="container mx-auto p-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Loyalty Discounts</CardTitle>
                        <CardDescription>Manage discount tiers for loyalty customers.</CardDescription>
                    </div>
                    <AddLoyaltyDiscount onSuccess={refreshData} />
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    )}
                    {error && <p className="text-red-500">Error: {error}</p>}
                    {!isLoading && discounts && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Points Required</TableHead>
                                    <TableHead>Discount (%)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedItems.map((discount) => (
                                    <TableRow key={discount.id}>
                                        <TableCell>{discount.name}</TableCell>
                                        <TableCell>{discount.points_required}</TableCell>
                                        <TableCell>{discount.discount_percentage}%</TableCell>
                                        <TableCell>
                                            <Badge variant={discount.is_active ? 'default' : 'destructive'}>
                                                {discount.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <EditLoyaltyDiscount discount={discount} onSuccess={refreshData} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!paginatedItems || paginatedItems.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            No loyalty discounts found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                    {!isLoading && !error && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
