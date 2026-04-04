'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Reservation, Room, ReservationStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const statusColors: Record<ReservationStatus, string> = {
  'booked': 'bg-yellow-500 text-white',
  'confirmed': 'bg-green-500 text-white',
  'checked-in': 'bg-blue-500 text-white',
  'checked-out': 'bg-gray-500 text-white',
  'cancelled': 'bg-red-500 text-white',
};

export default function ReservationsPage() {
  const { toast } = useToast();
  const supabase = createClient();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form states
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [status, setStatus] = useState<ReservationStatus>('booked');
  const [totalCost, setTotalCost] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resReservations, resRooms] = await Promise.all([
        fetch('/api/admin/reservations'),
        supabase.from('rooms').select('*')
      ]);

      const dataReservations = await resReservations.json();
      if (dataReservations.error) throw new Error(dataReservations.error);
      setReservations(dataReservations.reservations || []);

      if (resRooms.error) throw resRooms.error;
      setRooms(resRooms.data || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch reservations." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-calculate total price
  useEffect(() => {
    if (roomId && checkInDate && checkOutDate) {
      const room = rooms.find(r => r.id === roomId);
      if (room && room.pricePerNight) {
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const nights = diffDays > 0 ? diffDays : 1;
        if (!isNaN(nights) && nights > 0) {
          const calculatedPrice = (nights * room.pricePerNight).toFixed(2);
          setTotalCost(calculatedPrice);
        }
      }
    }
  }, [roomId, checkInDate, checkOutDate, rooms]);

  const resetForm = () => {
    setGuestName('');
    setGuestEmail('');
    setRoomId('');
    setCheckInDate('');
    setCheckOutDate('');
    setStatus('booked');
    setTotalCost('');
    setEditingReservation(null);
  };

  const handleOpenDialog = (reservation?: Reservation) => {
    if (reservation) {
      setEditingReservation(reservation);
      setGuestName(reservation.guest_name);
      setGuestEmail(reservation.guest_email || '');
      setRoomId(reservation.room_id);
      setCheckInDate(reservation.check_in_date);
      setCheckOutDate(reservation.check_out_date);
      setStatus(reservation.status);
      setTotalCost(reservation.total_cost.toString());
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingReservation ? 'PUT' : 'POST';
      const body = {
        id: editingReservation?.id,
        guest_name: guestName,
        guest_email: guestEmail,
        room_id: roomId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        status,
        total_cost: parseFloat(totalCost)
      };

      const res = await fetch('/api/admin/reservations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({
        title: editingReservation ? "Reservation Updated" : "Reservation Created",
        description: editingReservation ? "The reservation details have been updated." : "New reservation created.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving reservation:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to save reservation." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/reservations?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "Reservation Deleted", description: "The reservation has been removed." });
      setReservations(reservations.filter(r => r.id !== deleteId));
    } catch (error) {
      console.error("Error deleting reservation:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete reservation." });
    } finally {
      setDeleteId(null);
    }
  };

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(reservations, 20);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold">Reservation Management</h1>
          <p className="text-muted-foreground">Manage room reservations and bookings.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Reservation
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total (LKR)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No reservations found.</TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((res) => (
                <TableRow key={res.id}>
                  <TableCell>
                    <div className="font-medium">{res.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{res.guest_email}</div>
                  </TableCell>
                  <TableCell>{res.room_title}</TableCell>
                  <TableCell>{new Date(res.check_in_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(res.check_out_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`capitalize ${statusColors[res.status] || 'bg-gray-500 text-white'}`}>
                      {res.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">LKR {(res.total_cost ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(res)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(res.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReservation ? 'Edit Reservation' : 'New Reservation'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Guest Name</Label>
                <Input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Guest Email</Label>
                <Input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <Select value={roomId} onValueChange={setRoomId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.title} ({room.room_number}) - LKR {room.pricePerNight}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check-in Date</Label>
                <Input id="checkIn" type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOut">Check-out Date</Label>
                <Input id="checkOut" type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked-in">Checked-In</SelectItem>
                    <SelectItem value="checked-out">Checked-Out</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalCost">Total Cost</Label>
                <Input id="totalCost" type="number" step="0.01" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} required />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" className="w-full">
                {editingReservation ? 'Update Reservation' : 'Create Reservation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the reservation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
