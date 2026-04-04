
'use client';

import { useState, useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoreHorizontal, PlusCircle, Trash2, Edit, CheckCircle, BedDouble, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Reservation, ReservationStatus, Room } from '@/lib/types';
import { useSupabaseCollection } from '@/hooks/use-supabase-collection';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingForm } from '@/components/dashboard/bookings/booking-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { format } from 'date-fns';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const statusColors: Record<ReservationStatus, string> = {
  confirmed: 'bg-blue-500 text-white',
  'checked-in': 'bg-yellow-500 text-white',
  'checked-out': 'bg-green-500 text-white',
  cancelled: 'bg-red-500 text-white',
  booked: 'bg-gray-500 text-white',
};

export default function BookingManagementPage() {
  const { toast } = useToast();
  const { user: currentUser } = useUserContext();
  const supabase = createClient();

  const { data: bookings, loading: areBookingsLoading, refetch: refetchBookings } = useSupabaseCollection<Reservation>('reservations');
  const { data: rooms, loading: areRoomsLoading } = useSupabaseCollection<Room>('rooms');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Reservation | null>(null);

  const handleAddBookingClick = () => {
    setEditingBooking(null);
    setIsDialogOpen(true);
  };

  const handleEditBookingClick = (booking: Reservation) => {
    setEditingBooking(booking);
    setIsDialogOpen(true);
  };

  const handleDeleteBooking = async (id: string) => {
    if (!currentUser) return;
    if (confirm('Are you sure you want to delete this booking? This cannot be undone.')) {
      const { error } = await supabase.from('reservations').delete().eq('id', id);

      if (error) {
        console.error("Error deleting booking: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete booking.",
        });
      } else {
        toast({
          title: 'Booking Deleted',
          description: 'The booking has been successfully removed.',
        });
        refetchBookings();
      }
    }
  };

  const handleCheckIn = async (booking: Reservation) => {
    if (!currentUser) return;

    try {
      const { error: bookingError } = await supabase.from('reservations').update({ status: 'checked-in' }).eq('id', booking.id);
      if (bookingError) throw bookingError;

      const { error: roomError } = await supabase.from('rooms').update({ status: 'occupied' }).eq('id', booking.room_id);
      if (roomError) throw roomError;

      toast({ title: 'Checked In', description: `${booking.guest_name} has been checked in.` });
      refetchBookings();
    } catch (error) {
      console.error("Error checking in:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to check in." });
    }
  }

  const handleCheckOut = async (booking: Reservation) => {
    if (!currentUser) return;

    try {
      const { error: bookingError } = await supabase.from('reservations').update({ status: 'checked-out' }).eq('id', booking.id);
      if (bookingError) throw bookingError;

      const { error: roomError } = await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);
      if (roomError) throw roomError;

      toast({ title: 'Checked Out', description: `${booking.guest_name} has been checked out.` });
      refetchBookings();
    } catch (error) {
      console.error("Error checking out:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to check out." });
    }
  };

  const handleCancelBooking = async (booking: Reservation) => {
    if (!currentUser) return;
    if (confirm(`Are you sure you want to cancel the booking for ${booking.guest_name}?`)) {
      try {
        const { error: bookingError } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', booking.id);
        if (bookingError) throw bookingError;

        // Only make the room available if it was occupied by this booking
        if (booking.status === 'checked-in' || booking.status === 'confirmed') {
          const { error: roomError } = await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);
          if (roomError) throw roomError;
        }
        toast({ title: 'Booking Cancelled', description: `The booking for ${booking.guest_name} has been cancelled.` });
        refetchBookings();
      } catch (error) {
        console.error("Error cancelling booking: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to cancel booking.",
        });
      }
    }
  };


  const sortedBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings].sort((a, b) => {
      const dateA = a.check_in_date ? new Date(a.check_in_date).getTime() : 0;
      const dateB = b.check_in_date ? new Date(b.check_in_date).getTime() : 0;
      return dateB - dateA;
    });
  }, [bookings]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(sortedBookings, 20);

  const getFormattedDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    // Add one day to the date to correct for timezone issues
    date.setDate(date.getDate() + 1);
    return format(date, 'PPP');
  };

  if (!currentUser || areBookingsLoading || areRoomsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-bold">Booking Management</h1>
          <p className="text-muted-foreground">Manage all room bookings.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) setEditingBooking(null);
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleAddBookingClick}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBooking ? 'Edit Booking' : 'Add New Booking'}</DialogTitle>
            </DialogHeader>
            <BookingForm
              booking={editingBooking}
              rooms={rooms || []}
              onClose={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
          <CardDescription>A list of all current and past bookings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest Name</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areBookingsLoading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {!areBookingsLoading && sortedBookings && paginatedItems.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.guest_name}</TableCell>
                  <TableCell>{booking.room_title}</TableCell>
                  <TableCell>{getFormattedDate(booking.check_in_date)}</TableCell>
                  <TableCell>{getFormattedDate(booking.check_out_date)}</TableCell>
                  <TableCell>LKR {(booking.total_cost ?? 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`capitalize ${statusColors[booking.status]}`}>
                      {booking.status}
                    </Badge>
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
                        {booking.status === 'confirmed' && (
                          <DropdownMenuItem onClick={() => handleCheckIn(booking)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Check-In
                          </DropdownMenuItem>
                        )}
                        {booking.status === 'checked-in' && (
                          <DropdownMenuItem onClick={() => handleCheckOut(booking)}>
                            <BedDouble className="mr-2 h-4 w-4" />
                            Check-Out
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEditBookingClick(booking)}>
                          <Edit className="mr-2 h-4 w-4" />
                          View/Edit
                        </DropdownMenuItem>
                        {(booking.status === 'confirmed' || booking.status === 'checked-in') && (
                          <DropdownMenuItem onClick={() => handleCancelBooking(booking)}>
                            <XCircle className="mr-2 h-4 w-4 text-destructive" />
                            Cancel Booking
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => handleDeleteBooking(booking.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!areBookingsLoading && (!sortedBookings || sortedBookings.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No bookings found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!areBookingsLoading && sortedBookings && sortedBookings.length > 0 && (
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

