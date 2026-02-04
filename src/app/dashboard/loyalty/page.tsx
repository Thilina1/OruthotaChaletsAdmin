
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Gem } from 'lucide-react';
import type { LoyaltyCustomer } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { LoyaltyForm } from '@/components/dashboard/loyalty/loyalty-form';
import { format } from 'date-fns';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { createClient } from '@/lib/supabase/client';

const ITEMS_PER_PAGE = 20;

export default function LoyaltyCustomerPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<LoyaltyCustomer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('loyalty_customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch loyalty customers.',
      });
    } else {
      setCustomers(data as LoyaltyCustomer[]);
    }
    setIsLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalPages = customers ? Math.ceil(customers.length / ITEMS_PER_PAGE) : 0;
  const paginatedCustomers = customers?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddCustomerClick = () => {
    setEditingCustomer(null);
    setIsDialogOpen(true);
  };

  const handleEditCustomerClick = (customer: LoyaltyCustomer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer? This cannot be undone.')) {
      const { error } = await supabase.from('loyalty_customers').delete().eq('id', id);

      if (error) {
        console.error('Error deleting customer:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete customer.",
        });
      } else {
        toast({
          title: 'Customer Deleted',
          description: 'The customer has been successfully removed.',
        });
        fetchCustomers();
      }
    }
  };

  const handleFormSubmit = async (values: Omit<LoyaltyCustomer, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingCustomer) {
      const { error } = await supabase
        .from('loyalty_customers')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', editingCustomer.id);

      if (error) {
        console.error('Error updating customer:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update customer.",
        });
      } else {
        toast({
          title: "Customer Updated",
          description: "The customer details have been updated.",
        });
        fetchCustomers();
      }

    } else {
      const { error } = await supabase
        .from('loyalty_customers')
        .insert([{ ...values }]);

      if (error) {
        console.error('Error adding customer:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add customer.",
        });
      } else {
        toast({
          title: "Customer Added",
          description: "A new loyalty customer has been registered.",
        });
        fetchCustomers();
      }
    }
    setIsDialogOpen(false);
    setEditingCustomer(null);
  };

  const getFormattedDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return format(date, 'PPP');
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-bold">Loyalty Customers</h1>
          <p className="text-muted-foreground">Manage your loyalty program members.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) setEditingCustomer(null);
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleAddCustomerClick}>
              <PlusCircle className="mr-2 h-4 w-4" /> Register Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Register New Customer'}</DialogTitle>
            </DialogHeader>
            <LoyaltyForm
              customer={editingCustomer}
              onSubmit={handleFormSubmit}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Customers</CardTitle>
          <CardDescription>A list of all customers in the loyalty program.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mobile Number</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Loyalty Points</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <>
                  {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {!isLoading && paginatedCustomers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.mobile_number}</TableCell>
                  <TableCell>{getFormattedDate(customer.dob)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium text-primary">
                      <Gem className="h-4 w-4" />
                      {customer.total_loyalty_points}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCustomerClick(customer)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => handleDeleteCustomer(customer.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!paginatedCustomers || paginatedCustomers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No customers found. Register one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="p-2 text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
