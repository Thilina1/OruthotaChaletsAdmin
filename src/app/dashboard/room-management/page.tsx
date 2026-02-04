
'use client';

import { useState } from 'react';
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
import { MoreHorizontal, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Room, RoomStatus } from '@/lib/types';
import { useSupabaseCollection } from '@/hooks/use-supabase-collection';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { RoomForm } from '@/components/dashboard/room-management/room-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import Image from 'next/image';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';

const statusColors: Record<RoomStatus, string> = {
    available: 'bg-green-500 text-white',
    occupied: 'bg-yellow-500 text-white',
    maintenance: 'bg-gray-500 text-white',
};

const ITEMS_PER_PAGE = 20;

export default function RoomManagementPage() {
    const { toast } = useToast();
    const { user: currentUser } = useUserContext();
    const supabase = createClient();

    const { data: rooms, loading: areRoomsLoading, refetch } = useSupabaseCollection<Room>('rooms');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = rooms ? Math.ceil(rooms.length / ITEMS_PER_PAGE) : 0;
    const paginatedRooms = rooms?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleAddRoomClick = () => {
        setEditingRoom(null);
        setIsDialogOpen(true);
    };

    const handleEditRoomClick = (room: Room) => {
        setEditingRoom(room);
        setIsDialogOpen(true);
    };

    const handleDeleteRoom = async (id: string) => {
        if (!currentUser) return;
        if (confirm('Are you sure you want to delete this room? This cannot be undone.')) {
            const { error } = await supabase.from('rooms').delete().eq('id', id);

            if (error) {
                console.error("Error deleting room: ", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to delete room.",
                });
            } else {
                toast({
                    title: 'Room Deleted',
                    description: 'The room has been successfully removed.',
                });
                refetch();
            }
        }
    };

    const handleFormSubmit = async (values: any) => {
        if (!currentUser) return;

        // Map form values (camelCase) to DB columns (snake_case)
        const roomData = {
            title: values.title,
            room_number: values.roomNumber,
            description: values.description, // Assuming description exists in DB even if not in type (it was in DB dump)
            type: values.type,
            price_per_night: values.pricePerNight, // User's dump said pricePerNight, but we are standardizing on snake_case for new/fixed schema if possible?
            // WAIT. If I use snake_case here 'price_per_night', I must ensure the DB column IS 'price_per_night'.
            // In my migration script I did NOT rename 'pricePerNight'. The user's dump said 'pricePerNight'.
            // If I stick to the user's existing schema for 'rooms' table, I must use 'pricePerNight'.
            // But I updated 'types.ts' to 'pricePerNight'. 
            // WAIT. In previous step I updated 'types.ts'. Let's check what I wrote for Room.
            // I wrote: pricePerNight: number; (camelCase) in types.ts?
            // Let me check my previous output for types.ts (Step 169).
            // "pricePerNight: number;" -> YES. I kept camelCase for Room!
            // BUT for Reservation I changed to 'guest_name', 'check_in_date'.
            // This is INCONSISTENT.
            // I need to start by checking types.ts again to be absolutely sure.
            // If I kept pricePerNight in Room, then RoomManagementPage rendering was actually CORRECT (mostly).
            // But room.roomNumber -> I changed type to room_number.

            // Let's assume I want to standardize on snake_case generally, but if the DB has camelCase I have to use it.
            // However, for consistency, I should probably use snake_case in Typescript and map it, or use snake_case in DB.
            // Since I can't easily change existing DB columns without migration (which I wrote in migration script), 
            // let's look at the migration script I wrote (Step 160/168).
            // "ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_number text;" -> snake_case
            // "ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS type text;"
            // I did NOT rename pricePerNight.

            // So `rooms` table has MIXED casing: `pricePerNight`, `room_number`.
            // This is ugly but I must follow it.

            // So for Room:
            // room_number (snake)
            // pricePerNight (camel - existing)
            // roomCount (camel - existing)
            // type (new - added as snake? No, simple name 'type')
            // status (new - simple name)

            // So I need to match this specific Mixed reality.

            room_number: values.roomNumber,
            type: values.type,
            pricePerNight: values.pricePerNight,
            roomCount: values.roomCount,
            view: values.view,
            status: values.status,
            imageUrl: values.imageUrl,
        };

        if (editingRoom) {
            const { error } = await supabase.from('rooms').update(roomData).eq('id', editingRoom.id);

            if (error) {
                console.error("Error updating room: ", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to update room.",
                });
            } else {
                toast({
                    title: "Room Updated",
                    description: "The room details have been updated.",
                });
                refetch();
            }
        } else {
            const { error } = await supabase.from('rooms').insert([roomData]);

            if (error) {
                console.error("Error creating room: ", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to create room.",
                });
            } else {
                toast({
                    title: "Room Created",
                    description: "A new room has been successfully added.",
                });
                refetch();
            }
        }
        setIsDialogOpen(false);
        setEditingRoom(null);
    };

    if (!currentUser || areRoomsLoading) {
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
                    <h1 className="text-3xl font-headline font-bold">Room Management</h1>
                    <p className="text-muted-foreground">Manage all rooms in the hotel.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) setEditingRoom(null);
                    setIsDialogOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddRoomClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Room
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
                        </DialogHeader>
                        <RoomForm
                            room={editingRoom}
                            onSubmit={handleFormSubmit}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Rooms</CardTitle>
                    <CardDescription>A list of all rooms in your hotel.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Room Info</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Price/Night (LKR)</TableHead>
                                <TableHead>Count</TableHead>
                                <TableHead>View</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {areRoomsLoading && (
                                <>
                                    {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                            {!areRoomsLoading && paginatedRooms && paginatedRooms.map((room) => (
                                <TableRow key={room.id}>
                                    <TableCell>
                                        <div className="font-medium">{room.title}</div>
                                        <div className="text-sm text-muted-foreground">No: {room.room_number}</div>
                                    </TableCell>
                                    <TableCell>{room.type}</TableCell>
                                    <TableCell>
                                        {typeof room.pricePerNight === 'number'
                                            ? room.pricePerNight.toFixed(2)
                                            : 'N/A'}
                                    </TableCell>
                                    <TableCell>{room.roomCount}</TableCell>
                                    <TableCell>{room.view}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={`capitalize ${statusColors[room.status]}`}>
                                            {room.status}
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
                                                <DropdownMenuItem onClick={() => handleEditRoomClick(room)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => handleDeleteRoom(room.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!areRoomsLoading && (!paginatedRooms || paginatedRooms.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                        No rooms found. Add a room to get started.
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
