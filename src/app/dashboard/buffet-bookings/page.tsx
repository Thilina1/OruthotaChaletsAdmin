'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Mail, User, Calendar, MessageSquare, Phone, Utensils, Users as UsersIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import type { TableBooking, TableBookingStatus } from '@/lib/types';

const statusColors: Record<TableBookingStatus, string> = {
  'pending': 'bg-yellow-500 text-white',
  'confirmed': 'bg-green-500 text-white',
  'cancelled': 'bg-red-500 text-white',
};

export default function BuffetBookingsPage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<TableBooking | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('table_bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching buffet bookings:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load buffet bookings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: TableBookingStatus) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('table_bookings')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: `Booking status updated to ${newStatus}.` });
      
      // Update local state
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
      if (selectedBooking?.id === id) {
        setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const filtered = bookings.filter((booking) => {
    const q = searchQuery.toLowerCase();
    return (
      booking.name?.toLowerCase().includes(q) ||
      booking.email?.toLowerCase().includes(q) ||
      booking.phone?.toLowerCase().includes(q) ||
      booking.meal_type?.toLowerCase().includes(q)
    );
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(filtered, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold">Buffet Bookings</h1>
        <p className="text-muted-foreground">Manage table reservations for buffets.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>All Bookings</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading…' : `${totalItems} booking${totalItems !== 1 ? 's' : ''} found`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Booking Details</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Meal Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-muted-foreground">
                    <Utensils className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    {searchQuery ? 'No bookings match your search.' : 'No buffet bookings yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{booking.name}</span>
                        <span className="text-xs text-muted-foreground">{booking.email}</span>
                        {booking.phone && <span className="text-xs text-muted-foreground">{booking.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(booking.date).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1">
                            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {booking.guests}
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="capitalize">
                            {booking.meal_type}
                        </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize ${statusColors[booking.status]}`}>
                        {booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsDialogOpen(true);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && filtered.length > 0 && (
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

      {/* Booking Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Name</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedBooking.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking Date</p>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(selectedBooking.date).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                    <p className="text-sm flex items-center gap-2 truncate">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedBooking.email}`} className="text-primary hover:underline">
                        {selectedBooking.email}
                    </a>
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                    <p className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selectedBooking.phone || '—'}
                    </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meal Type</p>
                    <p className="font-medium capitalize">{selectedBooking.meal_type}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guests</p>
                    <p className="font-medium">{selectedBooking.guests} People</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                <Select 
                  disabled={isUpdating}
                  value={selectedBooking.status} 
                  onValueChange={(val) => handleStatusUpdate(selectedBooking.id, val as TableBookingStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comments</p>
                <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedBooking.comments || 'No comments provided.'}
                </div>
              </div>

              <div className="pt-4 border-t text-[10px] text-muted-foreground flex justify-between">
                  <span>ID: {selectedBooking.id}</span>
                  <span>Created: {new Date(selectedBooking.created_at || '').toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
