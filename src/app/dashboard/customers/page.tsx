'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Mail, Phone, CalendarDays, Edit } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = async (searchQuery = '') => {
    setIsLoading(true);
    try {
      const url = new URL('/api/admin/customers', window.location.origin);
      if (searchQuery) url.searchParams.append('search', searchQuery);
      
      const res = await fetch(url.toString());
      if (!res.ok) {
          const text = await res.text();
          try {
              const data = JSON.parse(text);
              throw new Error(data.error || 'Failed to load customers');
          } catch (e) {
              throw new Error(`Server error: ${res.status}`);
          }
      }
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to load customers." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers(search);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(customers, 15);

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingCustomer),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update customer');

      toast({ title: 'Success', description: 'Customer data updated successfully.' });
      setIsEditModalOpen(false);
      fetchCustomers(search);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            All Customers
          </h1>
          <p className="text-muted-foreground">Manage and view all registered customers and walk-ins.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, phone, or ID..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : (!paginatedItems || paginatedItems.length === 0) ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No customers found.</TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {customer.phone ? (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</span>
                      ) : null}
                      {customer.email ? (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</span>
                      ) : null}
                      {customer.id_number ? (
                        <span className="flex items-center gap-1 text-xs mt-1">ID: {customer.id_number}</span>
                      ) : null}
                      {customer.address ? (
                        <span className="flex items-center gap-1 text-xs truncate max-w-[200px]" title={customer.address}>
                           Address: {customer.address}
                        </span>
                      ) : null}
                      {!customer.phone && !customer.email && !customer.id_number && !customer.address && (
                        <span className="italic">No contact info</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="w-4 h-4" />
                      {new Date(customer.created_at || '').toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(customer)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                required
                value={editingCustomer?.name || ''}
                onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  value={editingCustomer?.phone || ''}
                  onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, phone: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={editingCustomer?.email || ''}
                  onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, email: e.target.value } : null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID / Passport Number (Optional)</Label>
              <Input
                value={editingCustomer?.id_number || ''}
                onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, id_number: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address (Optional)</Label>
              <Input
                value={editingCustomer?.address || ''}
                onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, address: e.target.value } : null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
