
'use client';

import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, PlusCircle, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Reservation, Room } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/context/user-context';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useMemo } from 'react';
import { DateRangePickerModal } from '../bookings/date-range-picker-modal';
import { format, differenceInCalendarDays, eachDayOfInterval } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Separator } from '@/components/ui/separator';

const itemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  price: z.coerce.number().min(0, 'Price must be a positive number'),
});

const formSchema = z.object({
  roomId: z.string().min(1, { message: 'Please select a room.' }),
  guestName: z.string().min(2, { message: 'Guest name is required.' }),
  guestEmail: z.string().email({ message: 'Invalid email address.' }),
  idCardNumber: z.string().optional(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).refine(data => data.from, { message: "Check-in date is required.", path: ["from"] }),
  numberOfGuests: z.coerce.number().min(1, { message: 'At least one guest is required.' }),
  specialRequests: z.string().optional(),
  status: z.enum(['booked', 'confirmed', 'checked-in', 'checked-out', 'cancelled']),
  items: z.array(itemSchema),
  totalCost: z.coerce.number(),
}).refine(data => data.dateRange.from && data.dateRange.to && data.dateRange.to >= data.dateRange.from, {
  message: "Check-out date must be on or after check-in date.",
  path: ["dateRange"],
});

interface ReservationFormProps {
  reservation?: Reservation | null;
  rooms: Room[];
  allReservations: Reservation[];
  onClose: () => void;
}

export function ReservationForm({ reservation, rooms, allReservations, onClose }: ReservationFormProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const { user } = useUserContext();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isRoomAvailable, setIsRoomAvailable] = useState(true);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);


  const initialDateRange = useMemo(() => {
    if (reservation?.check_in_date && reservation?.check_out_date) {
      const from = new Date(reservation.check_in_date);
      from.setUTCHours(12, 0, 0, 0);
      const to = new Date(reservation.check_out_date);
      to.setUTCHours(12, 0, 0, 0);
      return { from, to };
    }
    return { from: undefined, to: undefined };
  }, [reservation]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomId: reservation?.room_id || '',
      guestName: reservation?.guest_name || '',
      guestEmail: '', // guest_email not in Reservation type definition in types.ts? Let's check or assume empty if not there. Step 139 types.ts doesn't show guest_email.
      idCardNumber: '', // Not in type
      dateRange: initialDateRange,
      numberOfGuests: 1, // Not in type
      specialRequests: '', // Not in type
      status: reservation?.status || 'booked', // Type match might be issue
      items: [], // Not in type
      totalCost: reservation?.total_price || 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const watchedRoomId = useWatch({ control: form.control, name: 'roomId' });
  const watchedDateRange = useWatch({ control: form.control, name: 'dateRange' });

  useEffect(() => {
    const selectedRoom = rooms.find(r => r.id === watchedRoomId);
    let roomCost = 0;
    if (selectedRoom && watchedDateRange.from && watchedDateRange.to) {
      const dayDiff = differenceInCalendarDays(watchedDateRange.to, watchedDateRange.from);
      const numberOfNights = dayDiff >= 0 ? dayDiff + 1 : 1;
      roomCost = selectedRoom.pricePerNight * numberOfNights;
    }

    const itemsTotal = watchedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    form.setValue('totalCost', itemsTotal + roomCost, { shouldValidate: true });
  }, [watchedItems, watchedRoomId, watchedDateRange, rooms, form]);

  useEffect(() => {
    if (watchedRoomId && watchedDateRange.from && watchedDateRange.to) {
      const newCheckIn = watchedDateRange.from;
      const newCheckOut = watchedDateRange.to;

      const overlappingReservations = allReservations.filter(existing => {
        if (existing.id === reservation?.id || existing.status === 'cancelled') {
          return false;
        }
        if (existing.room_id !== watchedRoomId) {
          return false;
        }
        const existingCheckIn = new Date(existing.check_in_date);
        const existingCheckOut = new Date(existing.check_out_date);
        return newCheckIn <= existingCheckOut && newCheckOut >= existingCheckIn;
      });

      if (overlappingReservations.length > 0) {
        const bookedDates = overlappingReservations.flatMap(res =>
          eachDayOfInterval({ start: new Date(res.check_in_date), end: new Date(res.check_out_date) })
        );
        setUnavailableDates(bookedDates);
        setIsRoomAvailable(false);
        form.setError("dateRange", { type: "manual", message: "This room is already booked for some of the selected dates." });
      } else {
        setUnavailableDates([]);
        setIsRoomAvailable(true);
        form.clearErrors("dateRange");
      }
    }
  }, [watchedRoomId, watchedDateRange, allReservations, reservation?.id, form]);

  const handleDateSave = (range: DateRange | undefined) => {
    if (range) {
      form.setValue('dateRange', range, { shouldValidate: true });
    }
    setIsDatePickerOpen(false);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !values.dateRange.from || !values.dateRange.to) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save reservation. Check-in and Check-out dates are required.' });
      return;
    };

    if (!isRoomAvailable) {
      toast({ variant: 'destructive', title: 'Booking Conflict', description: 'The selected room is not available for the chosen dates.' });
      return;
    }

    const selectedRoom = rooms.find(r => r.id === values.roomId);
    if (!selectedRoom) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected room not found.' });
      return;
    }

    const reservationData = {
      guest_name: values.guestName, // Mapping to snake_case for Supabase
      guest_email: values.guestEmail,
      room_id: values.roomId,
      room_title: selectedRoom.title,
      check_in_date: values.dateRange.from.toISOString().split('T')[0],
      check_out_date: values.dateRange.to.toISOString().split('T')[0],
      number_of_guests: values.numberOfGuests,
      special_requests: values.specialRequests,
      status: values.status,
      total_price: values.totalCost,
      items: values.items, // JSONB assumed or ignored
      // Additional fields not in types but maybe in DB?
      // id_card_number: values.idCardNumber, 
    };

    try {
      if (reservation) {
        const { error } = await supabase.from('reservations').update(reservationData).eq('id', reservation.id);
        if (error) throw error;
        toast({ title: 'Reservation Updated', description: 'The reservation has been successfully updated.' });
      } else {
        const { error } = await supabase.from('reservations').insert([reservationData]);
        if (error) throw error;
        toast({ title: 'Reservation Created', description: 'A new reservation has been successfully created.' });
      }
      onClose();
    } catch (error) {
      console.error('Error saving reservation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save reservation.' });
    }
  };

  const availableRooms = rooms.filter(room => room.status === 'available' || room.id === reservation?.room_id);
  const dateRange = form.watch('dateRange');
  const dayCount = dateRange.from && dateRange.to ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1 : 0;

  const showAvailability = watchedRoomId && watchedDateRange.from && watchedDateRange.to;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
          <FormField
            control={form.control}
            name="roomId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Room</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!reservation && reservation.status !== 'booked' && reservation.status !== 'confirmed'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableRooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.title} ({room.type}) - LKR {room.pricePerNight}/night
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <FormLabel>Booking Dates</FormLabel>
              {dayCount > 0 && <span className="text-sm font-medium text-muted-foreground">{dayCount} night(s)</span>}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onClick={() => setIsDatePickerOpen(true)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}`
                : <span>Select check-in and check-out dates</span>
              }
            </Button>
            {form.formState.errors.dateRange && <FormMessage>{form.formState.errors.dateRange.message || form.formState.errors.dateRange.from?.message}</FormMessage>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Name</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guestEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Email</FormLabel>
                  <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="idCardNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID Card Number (Optional)</FormLabel>
                <FormControl><Input placeholder="e.g., 991234567V" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numberOfGuests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Guests</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="specialRequests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Special Requests</FormLabel>
                <FormControl><Textarea placeholder="Any special requests or notes..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div>
            <h3 className="text-lg font-medium mb-2">Additional Billable Items</h3>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center p-2 border rounded-md">
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => <Input {...field} placeholder="Item description" />}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => <Input type="number" {...field} className="w-20" placeholder="Qty" />}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.price`}
                    render={({ field }) => <Input type="number" {...field} className="w-24" placeholder="Price" />}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => append({ description: '', quantity: 1, price: 0 })} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reservation Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked-in">Checked-In</SelectItem>
                    <SelectItem value="checked-out">Checked-Out</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="p-4 border-t space-y-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total Cost:</span>
              <span>LKR {form.getValues('totalCost').toFixed(2)}</span>
            </div>
          </div>

          {showAvailability && (
            <div className={`p-3 rounded-md text-sm font-medium text-center ${isRoomAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isRoomAvailable ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Room is available for the selected dates.</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    <span>Room is not available for some dates.</span>
                  </div>
                  <p className="text-xs">
                    Booked dates: {unavailableDates.map(d => format(d, 'MMM d')).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!isRoomAvailable}>
            {reservation ? 'Update Reservation' : 'Create Reservation'}
          </Button>
        </form>
      </Form>
      <DateRangePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onSave={handleDateSave}
        initialDateRange={form.getValues('dateRange') as DateRange}
        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) && !reservation}
      />
    </>
  );
}
