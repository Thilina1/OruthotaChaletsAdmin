'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { ChaletRoom, ChaletRoomStatus } from '@/lib/types';
import { Pencil, AlertCircle } from 'lucide-react';

const statusConfig: Record<ChaletRoomStatus, { label: string; className: string }> = {
    available: { label: 'Available', className: 'bg-green-100 text-green-800 border-green-200' },
    occupied: { label: 'Occupied', className: 'bg-red-100 text-red-800 border-red-200' },
    maintenance: { label: 'Maintenance', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    cleaning: { label: 'Cleaning', className: 'bg-blue-100 text-blue-800 border-blue-200' },
};

const emptyForm = {
    name: '',
    room_number: '',
    floor: '',
    description: '',
    status: 'available' as ChaletRoomStatus,
    notes: '',
    sort_order: 0,
};

export default function ChaletRoomsPage() {
    const { toast } = useToast();
    const [rooms, setRooms] = useState<ChaletRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/chalet/rooms');
            const data = await res.json();
            setRooms(data.rooms || []);
        } catch {
            toast({ title: 'Error', description: 'Failed to load rooms', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchRooms(); }, [fetchRooms]);

    const openEdit = (room: ChaletRoom) => {
        setEditingId(room.id);
        setForm({
            name: room.name,
            room_number: room.room_number,
            floor: room.floor || '',
            description: room.description || '',
            status: room.status,
            notes: room.notes || '',
            sort_order: room.sort_order,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.room_number) {
            toast({ title: 'Validation', description: 'Name and room number are required', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const payload = { ...form, ...(editingId ? { id: editingId } : {}) };
            const res = await fetch('/api/chalet/rooms', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: editingId ? 'Room updated' : 'Room created' });
            setDialogOpen(false);
            fetchRooms();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (room: ChaletRoom, newStatus: ChaletRoomStatus) => {
        setStatusUpdating(room.id);
        try {
            const res = await fetch('/api/chalet/rooms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: room.id, status: newStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setRooms(prev => prev.map(r => r.id === room.id ? { ...r, status: newStatus } : r));
            toast({ title: 'Status Updated', description: `Chalet ${room.room_number} is now ${newStatus}` });
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setStatusUpdating(null);
        }
    };

    const statusCounts = (Object.keys(statusConfig) as ChaletRoomStatus[]).map(s => ({
        status: s,
        count: rooms.filter(r => r.status === s).length,
    }));

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Chalet Rooms</h1>
                    <p className="text-muted-foreground">Manage room status and details</p>
                </div>
            </div>

            {/* Status summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statusCounts.map(({ status, count }) => (
                    <Card key={status}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground capitalize">{statusConfig[status].label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? <Skeleton className="h-8 w-10" /> : <p className="text-2xl font-bold">{count}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Room cards */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-full" /></CardContent></Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {rooms.map(room => (
                        <Card key={room.id} className="relative">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{room.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">Room #{room.room_number}{room.floor ? ` · Floor ${room.floor}` : ''}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => openEdit(room)}>
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {room.description && (
                                    <p className="text-xs text-muted-foreground">{room.description}</p>
                                )}
                                {room.notes && (
                                    <p className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">{room.notes}</p>
                                )}
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={`text-xs border ${statusConfig[room.status].className}`}
                                    >
                                        {statusConfig[room.status].label}
                                    </Badge>
                                </div>
                                <Select
                                    value={room.status}
                                    onValueChange={v => handleStatusChange(room, v as ChaletRoomStatus)}
                                    disabled={statusUpdating === room.id}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(statusConfig) as ChaletRoomStatus[]).map(s => (
                                            <SelectItem key={s} value={s} className="text-xs">{statusConfig[s].label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Chalet Room' : 'Add Chalet Room'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Room Name *</Label>
                                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Chalet 01" />
                            </div>
                            <div className="space-y-1">
                                <Label>Room Number *</Label>
                                <Input value={form.room_number} onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))} placeholder="01" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Floor</Label>
                                <Input value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} placeholder="Ground" />
                            </div>
                            <div className="space-y-1">
                                <Label>Sort Order</Label>
                                <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as ChaletRoomStatus }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(statusConfig) as ChaletRoomStatus[]).map(s => (
                                        <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Room description..." rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label>Notes</Label>
                            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Room' : 'Create Room'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
