
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
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import Image from 'next/image';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

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

    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems: paginatedRooms,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(rooms || [], 20);

    const handleAddRoomClick = () => {
        setEditingRoom(null);
        setIsDialogOpen(true);
    };

    const handleEditRoomClick = (room: Room) => {
        setEditingRoom(room);
        setTimeout(() => setIsDialogOpen(true), 50); // Delay allows DropdownMenu to release pointer-events lock
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
            description: values.description,
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
                <div className="flex items-center gap-4">
                    <Button onClick={handleAddRoomClick}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Room
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        if (!open) setEditingRoom(null);
                        setIsDialogOpen(open);
                    }}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                {editingRoom ? 'Update the details of this room.' : 'Fill out the form below to add a new room.'}
                            </DialogDescription>
                        </DialogHeader>
                        <RoomForm
                            room={editingRoom}
                            onSubmit={handleFormSubmit}
                        />
                    </DialogContent>
                </Dialog>
                </div>
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
                {!areRoomsLoading && (
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </Card>
        </div>
    );
}
