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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { ChaletBooking, ChaletPackage, ChaletOccupancyType, ChaletRoom, ChaletRate, ChaletBookingStatus } from '@/lib/types';
import { Plus, Pencil, Trash2, BedDouble, CheckCircle, Clock, LogIn, AlertCircle, Search, ClipboardList } from 'lucide-react';

const statusColors: Record<ChaletBookingStatus, string> = {
    pending: 'bg-orange-100 text-orange-800 border-orange-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    checked_in: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    checked_out: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<ChaletBookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    checked_in: 'Checked In',
    checked_out: 'Checked Out',
    cancelled: 'Cancelled',
};

const emptyForm = {
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_nic: '',
    nationality: '',
    check_in_date: '',
    check_out_date: '',
    package_id: '',
    occupancy_type_id: '',
    adults: 1,
    children: 0,
    room_id: '',
    rate_per_night: 0,
    service_charge_pct: 10,
    status: 'pending' as ChaletBookingStatus,
    special_requests: '',
    notes: '',
};

function formatCurrency(n: number) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: 2 });
}

export default function ChaletBookingsPage() {
    const { toast } = useToast();
    const [bookings, setBookings] = useState<ChaletBooking[]>([]);
    const [packages, setPackages] = useState<ChaletPackage[]>([]);
    const [occupancyTypes, setOccupancyTypes] = useState<ChaletOccupancyType[]>([]);
    const [rooms, setRooms] = useState<ChaletRoom[]>([]);
    const [rates, setRates] = useState<ChaletRate[]>([]);
    const [loading, setLoading] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [assigningBooking, setAssigningBooking] = useState<ChaletBooking | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [assigning, setAssigning] = useState(false);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Checked-In Guests tab
    const [checkedInSearch, setCheckedInSearch] = useState('');
    const [checkedInDate, setCheckedInDate] = useState(() => new Date().toISOString().slice(0, 10));

    // Facility activity tracker
    const [activityBooking, setActivityBooking] = useState<ChaletBooking | null>(null);
    const [activityDialogOpen, setActivityDialogOpen] = useState(false);
    const [activityUsage, setActivityUsage] = useState<Set<string>>(new Set());
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);
    const [togglingActivityKey, setTogglingActivityKey] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [bRes, pRes, oRes, rRes, rateRes] = await Promise.all([
                fetch('/api/chalet/bookings'),
                fetch('/api/chalet/packages'),
                fetch('/api/chalet/occupancy-types'),
                fetch('/api/chalet/rooms'),
                fetch('/api/chalet/rates'),
            ]);
            const [bData, pData, oData, rData, rateData] = await Promise.all([
                bRes.json(), pRes.json(), oRes.json(), rRes.json(), rateRes.json(),
            ]);
            setBookings(bData.bookings || []);
            setPackages(pData.packages || []);
            setOccupancyTypes(oData.occupancy_types || []);
            setRooms(rData.rooms || []);
            setRates(rateData.rates || []);
        } catch {
            toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-lookup rate when package + occupancy type selected
    useEffect(() => {
        if (form.package_id && form.occupancy_type_id) {
            const rate = rates.find(
                r => r.package_id === form.package_id && r.occupancy_type_id === form.occupancy_type_id
            );
            if (rate) {
                setForm(prev => ({ ...prev, rate_per_night: Number(rate.rate_per_night) }));
            }
        }
    }, [form.package_id, form.occupancy_type_id, rates]);

    const nights = (() => {
        if (!form.check_in_date || !form.check_out_date) return 0;
        const diff = new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    })();

    const subtotal = form.rate_per_night * nights;
    const scAmount = subtotal * form.service_charge_pct / 100;
    const grandTotal = subtotal + scAmount;

    // Mirrors the overlap check in the API: back-to-back stays (one checks
    // out the day the next checks in) don't count as a conflict.
    const isRoomBooked = (roomId: string, checkIn: string, checkOut: string, excludeId?: string | null) => {
        if (!checkIn || !checkOut) return false;
        return bookings.some(b =>
            b.room_id === roomId &&
            b.status !== 'cancelled' &&
            b.id !== excludeId &&
            b.check_in_date < checkOut &&
            b.check_out_date > checkIn
        );
    };

    const openNew = () => {
        setEditingId(null);
        setForm({ ...emptyForm });
        setDialogOpen(true);
    };

    const openEdit = (b: ChaletBooking) => {
        setEditingId(b.id);
        setForm({
            customer_name: b.customer_name,
            customer_email: b.customer_email || '',
            customer_phone: b.customer_phone || '',
            customer_nic: b.customer_nic || '',
            nationality: b.nationality || '',
            check_in_date: b.check_in_date,
            check_out_date: b.check_out_date,
            package_id: b.package_id || '',
            occupancy_type_id: b.occupancy_type_id || '',
            adults: b.adults ?? 1,
            children: b.children ?? 0,
            room_id: b.room_id || '',
            rate_per_night: b.rate_per_night,
            service_charge_pct: b.service_charge_pct,
            status: b.status,
            special_requests: b.special_requests || '',
            notes: b.notes || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.customer_name || !form.check_in_date || !form.check_out_date) {
            toast({ title: 'Validation', description: 'Customer name, check-in and check-out are required', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                guest_count: form.adults + form.children,
                package_id: form.package_id || null,
                occupancy_type_id: form.occupancy_type_id || null,
                room_id: form.room_id || null,
                ...(editingId ? { id: editingId } : {}),
            };
            const res = await fetch('/api/chalet/bookings', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: editingId ? 'Booking updated' : 'Booking created' });
            window.dispatchEvent(new Event('notifications-changed'));
            setDialogOpen(false);
            fetchAll();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const openAssign = (b: ChaletBooking) => {
        setAssigningBooking(b);
        setSelectedRoomId(b.room_id || '');
        setAssignDialogOpen(true);
    };

    const handleAssignRoom = async () => {
        if (!assigningBooking) return;
        setAssigning(true);
        try {
            const res = await fetch('/api/chalet/bookings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: assigningBooking.id, room_id: selectedRoomId || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: 'Room assigned' });
            setAssignDialogOpen(false);
            fetchAll();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setAssigning(false);
        }
    };

    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/chalet/bookings?id=${deleteId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            toast({ title: 'Deleted', description: 'Booking removed' });
            window.dispatchEvent(new Event('notifications-changed'));
            setDeleteDialogOpen(false);
            fetchAll();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setDeleting(false);
        }
    };

    const stats = {
        total: bookings.length,
        pending: bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        checked_in: bookings.filter(b => b.status === 'checked_in').length,
    };

    // Meal flags + custom facilities on a package, flattened into one
    // checklist of { key, name } entries the front desk can mark used.
    const packageFacilities = (pkg?: ChaletPackage): { key: string; name: string }[] => {
        if (!pkg) return [];
        const list: { key: string; name: string }[] = [];
        if (pkg.includes_breakfast) list.push({ key: 'breakfast', name: 'Breakfast' });
        if (pkg.includes_lunch) list.push({ key: 'lunch', name: 'Lunch' });
        if (pkg.includes_dinner) list.push({ key: 'dinner', name: 'Dinner' });
        (pkg.facilities || []).forEach(f => list.push({ key: f.id, name: f.name }));
        return list;
    };

    // One entry per night of the stay (checkout day itself isn't a night).
    const stayDates = (checkIn: string, checkOut: string): string[] => {
        const dates: string[] = [];
        const cur = new Date(checkIn);
        const end = new Date(checkOut);
        while (cur < end) {
            dates.push(cur.toISOString().slice(0, 10));
            cur.setDate(cur.getDate() + 1);
        }
        return dates;
    };

    const checkedInGuests = bookings
        .filter(b => b.status === 'checked_in')
        .filter(b => {
            const q = checkedInSearch.trim().toLowerCase();
            if (q && !b.customer_name?.toLowerCase().includes(q)) return false;
            if (checkedInDate && !(b.check_in_date <= checkedInDate && checkedInDate <= b.check_out_date)) return false;
            return true;
        });

    const openActivities = async (booking: ChaletBooking) => {
        setActivityBooking(booking);
        setActivityDialogOpen(true);
        setIsLoadingActivity(true);
        try {
            const res = await fetch(`/api/chalet/facility-usage?booking_id=${booking.id}`);
            const data = await res.json();
            const usage: { facility_key: string; usage_date: string }[] = data.usage || [];
            setActivityUsage(new Set(usage.map(u => `${u.usage_date}|${u.facility_key}`)));
        } catch (e: any) {
            toast({ title: 'Error', description: 'Failed to load activity history', variant: 'destructive' });
        } finally {
            setIsLoadingActivity(false);
        }
    };

    const toggleActivity = async (date: string, facilityKey: string, facilityName: string) => {
        if (!activityBooking) return;
        const mapKey = `${date}|${facilityKey}`;
        setTogglingActivityKey(mapKey);
        const wasUsed = activityUsage.has(mapKey);

        // Optimistic toggle
        setActivityUsage(prev => {
            const next = new Set(prev);
            if (wasUsed) next.delete(mapKey); else next.add(mapKey);
            return next;
        });

        try {
            const res = await fetch('/api/chalet/facility-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: activityBooking.id,
                    facility_key: facilityKey,
                    facility_name: facilityName,
                    usage_date: date,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
        } catch (e: any) {
            // Revert on failure
            setActivityUsage(prev => {
                const next = new Set(prev);
                if (wasUsed) next.add(mapKey); else next.delete(mapKey);
                return next;
            });
            toast({ title: 'Error', description: e.message || 'Failed to update activity', variant: 'destructive' });
        } finally {
            setTogglingActivityKey(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Chalet Bookings</h1>
                    <p className="text-muted-foreground">Manage all chalet reservations</p>
                </div>
                <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Booking
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.total}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" />Confirmed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><LogIn className="h-3 w-3" />Checked In</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-yellow-600">{stats.checked_in}</p>}
                    </CardContent>
                </Card>
            </div>

            {/* Bookings / Checked-In Guests */}
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All Bookings</TabsTrigger>
                    <TabsTrigger value="checked-in">Checked-In Guests</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Booking Ref</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Package</TableHead>
                                            <TableHead>Occupancy</TableHead>
                                            <TableHead>Check In</TableHead>
                                            <TableHead>Check Out</TableHead>
                                            <TableHead className="text-center">Nights</TableHead>
                                            <TableHead className="text-right">Grand Total</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    {Array.from({ length: 11 }).map((_, j) => (
                                                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : bookings.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                                    No bookings yet. Create your first booking.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            bookings.map(b => (
                                                <TableRow key={b.id}>
                                                    <TableCell className="font-mono text-xs font-medium">{b.booking_ref}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{b.customer_name}</div>
                                                        {b.customer_phone && <div className="text-xs text-muted-foreground">{b.customer_phone}</div>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {b.chalet_rooms ? (
                                                            <span className="font-medium">Chalet {b.chalet_rooms.room_number}</span>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Unassigned</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{b.chalet_packages?.name || '—'}</TableCell>
                                                    <TableCell className="text-sm">{b.chalet_occupancy_types?.name || '—'}</TableCell>
                                                    <TableCell className="text-sm">{b.check_in_date}</TableCell>
                                                    <TableCell className="text-sm">{b.check_out_date}</TableCell>
                                                    <TableCell className="text-center">{b.nights}</TableCell>
                                                    <TableCell className="text-right font-medium">LKR {formatCurrency(b.grand_total)}</TableCell>
                                                    <TableCell>
                                                        <Badge className={`text-xs border ${statusColors[b.status]}`} variant="outline">
                                                            {statusLabels[b.status]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {!b.room_id && (
                                                                <Button size="sm" variant="outline" onClick={() => openAssign(b)} title="Assign Room">
                                                                    <BedDouble className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                            <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => confirmDelete(b.id)}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="checked-in" className="mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by customer name..."
                                value={checkedInSearch}
                                onChange={e => setCheckedInSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground whitespace-nowrap">As of date</Label>
                            <Input
                                type="date"
                                className="w-44"
                                value={checkedInDate}
                                onChange={e => setCheckedInDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Package</TableHead>
                                            <TableHead>Check In</TableHead>
                                            <TableHead>Check Out</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    {Array.from({ length: 6 }).map((_, j) => (
                                                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : checkedInGuests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No checked-in guests match your search/date.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            checkedInGuests.map(b => (
                                                <TableRow key={b.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{b.customer_name}</div>
                                                        {b.customer_phone && <div className="text-xs text-muted-foreground">{b.customer_phone}</div>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {b.chalet_rooms ? (
                                                            <span className="font-medium">Chalet {b.chalet_rooms.room_number}</span>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Unassigned</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{b.chalet_packages?.name || '—'}</TableCell>
                                                    <TableCell className="text-sm">{b.check_in_date}</TableCell>
                                                    <TableCell className="text-sm">{b.check_out_date}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="outline" onClick={() => openActivities(b)}>
                                                            <ClipboardList className="mr-1.5 h-3 w-3" />
                                                            Activities
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Booking Form Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Booking' : 'New Chalet Booking'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1 space-y-1">
                                <Label>Customer Name *</Label>
                                <Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Full name" />
                            </div>
                            <div className="space-y-1">
                                <Label>Email</Label>
                                <Input type="email" value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="email@example.com" />
                            </div>
                            <div className="space-y-1">
                                <Label>Phone</Label>
                                <Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="+94 77 000 0000" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>NIC / Passport</Label>
                                <Input value={form.customer_nic} onChange={e => setForm(p => ({ ...p, customer_nic: e.target.value }))} placeholder="NIC or passport number" />
                            </div>
                            <div className="space-y-1">
                                <Label>Nationality</Label>
                                <Input value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} placeholder="e.g. Sri Lankan" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Check-in Date *</Label>
                                <Input type="date" value={form.check_in_date} onChange={e => setForm(p => ({ ...p, check_in_date: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Check-out Date *</Label>
                                <Input type="date" value={form.check_out_date} onChange={e => setForm(p => ({ ...p, check_out_date: e.target.value }))} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Package</Label>
                                <Select value={form.package_id} onValueChange={v => setForm(p => ({ ...p, package_id: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                                    <SelectContent>
                                        {packages.map(pkg => (
                                            <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Occupancy Type</Label>
                                <Select value={form.occupancy_type_id} onValueChange={v => setForm(p => ({ ...p, occupancy_type_id: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select occupancy" /></SelectTrigger>
                                    <SelectContent>
                                        {occupancyTypes.map(ot => (
                                            <SelectItem key={ot.id} value={ot.id}>{ot.name} (max {ot.max_guests})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label>Adults</Label>
                                <Input type="number" min={1} value={form.adults} onChange={e => setForm(p => ({ ...p, adults: parseInt(e.target.value) || 1 }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Children</Label>
                                <Input type="number" min={0} value={form.children} onChange={e => setForm(p => ({ ...p, children: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Assign Chalet Room</Label>
                                <Select value={form.room_id || '__none__'} onValueChange={v => setForm(p => ({ ...p, room_id: v === '__none__' ? '' : v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select room (optional)" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Unassigned</SelectItem>
                                        {rooms.map(r => {
                                            const booked = isRoomBooked(r.id, form.check_in_date, form.check_out_date, editingId);
                                            return (
                                                <SelectItem key={r.id} value={r.id} disabled={booked}>
                                                    Chalet {r.room_number} — {booked ? 'Booked for these dates' : r.status}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Rate Per Night (LKR)</Label>
                                <Input type="number" min={0} step={0.01} value={form.rate_per_night} onChange={e => setForm(p => ({ ...p, rate_per_night: parseFloat(e.target.value) || 0 }))} />
                                {form.package_id && form.occupancy_type_id && (
                                    <p className="text-xs text-muted-foreground">Auto-filled from rate matrix</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>Service Charge (%)</Label>
                                <Input type="number" min={0} max={100} step={0.1} value={form.service_charge_pct} onChange={e => setForm(p => ({ ...p, service_charge_pct: parseFloat(e.target.value) || 0 }))} />
                            </div>
                        </div>

                        {/* Live totals */}
                        {nights > 0 && (
                            <div className="bg-muted rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Nights</p>
                                    <p className="font-semibold">{nights}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Subtotal</p>
                                    <p className="font-semibold">LKR {formatCurrency(subtotal)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">SC ({form.service_charge_pct}%)</p>
                                    <p className="font-semibold">LKR {formatCurrency(scAmount)}</p>
                                </div>
                                <div className="col-span-3 border-t pt-2">
                                    <p className="text-muted-foreground">Grand Total</p>
                                    <p className="text-lg font-bold">LKR {formatCurrency(grandTotal)}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as ChaletBookingStatus }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(statusLabels) as ChaletBookingStatus[]).map(s => (
                                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label>Special Requests</Label>
                            <Textarea value={form.special_requests} onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))} placeholder="Any special requests from the guest..." rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label>Internal Notes</Label>
                            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Booking' : 'Create Booking'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Room Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Chalet Room</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {assigningBooking && (
                            <div className="bg-muted rounded-lg p-3 text-sm">
                                <p className="font-medium">{assigningBooking.customer_name}</p>
                                <p className="text-muted-foreground">{assigningBooking.booking_ref} · {assigningBooking.check_in_date} → {assigningBooking.check_out_date}</p>
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label>Select Room</Label>
                            <Select value={selectedRoomId || '__none__'} onValueChange={v => setSelectedRoomId(v === '__none__' ? '' : v)}>
                                <SelectTrigger><SelectValue placeholder="Choose a chalet" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Unassigned</SelectItem>
                                    {rooms.map(r => {
                                        const booked = assigningBooking
                                            ? isRoomBooked(r.id, assigningBooking.check_in_date, assigningBooking.check_out_date, assigningBooking.id)
                                            : false;
                                        return (
                                            <SelectItem key={r.id} value={r.id} disabled={booked}>
                                                Chalet {r.room_number} — {r.name}
                                                <span className={`ml-2 text-xs ${booked ? 'text-red-600' : r.status === 'available' ? 'text-green-600' : 'text-orange-500'}`}>
                                                    {booked ? '(Booked for these dates)' : `(${r.status})`}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignRoom} disabled={assigning}>
                            {assigning ? 'Assigning...' : 'Assign Room'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            Delete Booking
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure you want to delete this booking? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Facility Activities Dialog */}
            <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Package Activities</DialogTitle>
                    </DialogHeader>
                    {activityBooking && (() => {
                        const pkg = packages.find(p => p.id === activityBooking.package_id);
                        const facilities = packageFacilities(pkg);
                        const dates = stayDates(activityBooking.check_in_date, activityBooking.check_out_date);

                        return (
                            <div className="space-y-4">
                                <div className="bg-muted rounded-lg p-3 text-sm">
                                    <p className="font-medium">{activityBooking.customer_name}</p>
                                    <p className="text-muted-foreground">
                                        {activityBooking.booking_ref} · {pkg?.name || 'No package assigned'} · {activityBooking.check_in_date} → {activityBooking.check_out_date}
                                    </p>
                                </div>

                                {!pkg ? (
                                    <p className="text-sm text-muted-foreground italic">No package is assigned to this booking, so there are no facilities to track.</p>
                                ) : facilities.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">This package has no meals or facilities configured. Add some under Chalet &gt; Rates &amp; Packages.</p>
                                ) : isLoadingActivity ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Day</TableHead>
                                                    {facilities.map(f => (
                                                        <TableHead key={f.key} className="text-center">{f.name}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dates.map((date, idx) => (
                                                    <TableRow key={date}>
                                                        <TableCell className="text-sm font-medium whitespace-nowrap">
                                                            Day {idx + 1}
                                                            <div className="text-xs text-muted-foreground font-normal">{date}</div>
                                                        </TableCell>
                                                        {facilities.map(f => {
                                                            const mapKey = `${date}|${f.key}`;
                                                            return (
                                                                <TableCell key={f.key} className="text-center">
                                                                    <Checkbox
                                                                        checked={activityUsage.has(mapKey)}
                                                                        disabled={togglingActivityKey === mapKey}
                                                                        onCheckedChange={() => toggleActivity(date, f.key, f.name)}
                                                                    />
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
