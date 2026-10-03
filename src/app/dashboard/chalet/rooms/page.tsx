'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { ChaletRoom, ChaletRoomCategory, ChaletRoomStatus } from '@/lib/types';
import { Bath, Bed, BedDouble, Check, ChevronLeft, ChevronRight, CirclePlay, Coffee, Dumbbell, GlassWater, Images, Info, Monitor, Pencil, Plus, Refrigerator, Ruler, ShieldCheck, ShowerHead, Snowflake, Trash2, Tv, User, Users, Waves, Wifi, Wind } from 'lucide-react';

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
    category_id: '',
    max_adults: '',
    max_children: '',
    max_guests: '',
    bed_type: '',
    status: 'available' as ChaletRoomStatus,
    notes: '',
    sort_order: 0,
};

type FacilityIconKey = 'check' | 'shower' | 'bath' | 'play' | 'tv' | 'wifi' | 'bed' | 'wind' | 'coffee' | 'fridge' | 'water' | 'snowflake' | 'waves' | 'gym' | 'safe';
type FacilityItem = { name: string; icon: FacilityIconKey };

const emptyCategoryForm = {
    name: '',
    description: '',
    area_sqm: '',
    room_count: 1,
    max_adults: 4,
    max_children: 2,
    max_guests: 4,
    bed_configurations: ['1 King', '2 Twin'] as string[],
    bathroom_features: [{ name: 'Shower', icon: 'shower' }] as FacilityItem[],
    entertainment_features: [{ name: 'DVD Player', icon: 'play' }, { name: 'Satellite / Cable TV', icon: 'tv' }] as FacilityItem[],
    general_amenities: [{ name: 'Hair Dryer', icon: 'wind' }] as FacilityItem[],
    internet_features: [{ name: 'FREE WiFi', icon: 'wifi' }] as FacilityItem[],
    image_urls: [] as string[],
    sort_order: 0,
    is_active: true,
};

const facilityIconOptions: { key: FacilityIconKey; label: string; icon: typeof Check }[] = [
    { key: 'check', label: 'Check', icon: Check },
    { key: 'shower', label: 'Shower', icon: ShowerHead },
    { key: 'bath', label: 'Bath', icon: Bath },
    { key: 'play', label: 'Player', icon: CirclePlay },
    { key: 'tv', label: 'TV', icon: Tv },
    { key: 'wifi', label: 'WiFi', icon: Wifi },
    { key: 'bed', label: 'Bed', icon: Bed },
    { key: 'wind', label: 'Hair Dryer', icon: Wind },
    { key: 'coffee', label: 'Coffee', icon: Coffee },
    { key: 'fridge', label: 'Fridge', icon: Refrigerator },
    { key: 'water', label: 'Water', icon: GlassWater },
    { key: 'snowflake', label: 'AC', icon: Snowflake },
    { key: 'waves', label: 'Pool/Spa', icon: Waves },
    { key: 'gym', label: 'Gym', icon: Dumbbell },
    { key: 'safe', label: 'Safe', icon: ShieldCheck },
];

function lines(value: string) {
    return value.split('\n').map(v => v.trim()).filter(Boolean);
}

function normalizeImageUrls(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(url => String(url).trim()).filter(Boolean);
    if (typeof value === 'string') return lines(value);
    return [];
}

function normalizeFacilityItems(value: unknown, fallbackIcon: FacilityIconKey): FacilityItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item): FacilityItem | null => {
            if (typeof item === 'string') return { name: item, icon: fallbackIcon };
            if (item && typeof item === 'object' && 'name' in item) {
                const record = item as { name?: unknown; icon?: unknown };
                const name = String(record.name || '').trim();
                if (!name) return null;
                const icon = facilityIconOptions.some(option => option.key === record.icon) ? record.icon as FacilityIconKey : fallbackIcon;
                return { name, icon };
            }
            return null;
        })
        .filter(Boolean) as FacilityItem[];
}

export default function ChaletRoomsPage() {
    const { toast } = useToast();
    const [rooms, setRooms] = useState<ChaletRoom[]>([]);
    const [categories, setCategories] = useState<ChaletRoomCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [categoryForm, setCategoryForm] = useState({ ...emptyCategoryForm });
    const [savingCategory, setSavingCategory] = useState(false);
    const [categoryStatusUpdating, setCategoryStatusUpdating] = useState<string | null>(null);
    const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
    const [deletingCategory, setDeletingCategory] = useState(false);
    const [infoCategory, setInfoCategory] = useState<ChaletRoomCategory | null>(null);
    const [infoImageIndex, setInfoImageIndex] = useState(0);
    const [roomSearch, setRoomSearch] = useState('');
    const [roomStatusFilter, setRoomStatusFilter] = useState<'all' | ChaletRoomStatus>('all');
    const [roomCategoryFilter, setRoomCategoryFilter] = useState('all');

    const fetchRooms = useCallback(async () => {
        setLoading(true);
        try {
            const [res, catRes] = await Promise.all([
                fetch('/api/chalet/rooms'),
                fetch('/api/chalet/room-categories'),
            ]);
            const [data, catData] = await Promise.all([res.json(), catRes.json()]);
            setRooms(data.rooms || []);
            setCategories(catData.categories || []);
        } catch {
            toast({ title: 'Error', description: 'Failed to load rooms', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchRooms(); }, [fetchRooms]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm });
        setDialogOpen(true);
    };

    const openEdit = (room: ChaletRoom) => {
        setEditingId(room.id);
        setForm({
            name: room.name,
            room_number: room.room_number,
            floor: room.floor || '',
            description: room.description || '',
            category_id: room.category_id || '',
            max_adults: room.max_adults == null ? '' : String(room.max_adults),
            max_children: room.max_children == null ? '' : String(room.max_children),
            max_guests: room.max_guests == null ? '' : String(room.max_guests),
            bed_type: room.bed_type || '',
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

    const openNewCategory = () => {
        setEditingCategoryId(null);
        setCategoryForm({ ...emptyCategoryForm });
        setCategoryDialogOpen(true);
    };

    const openEditCategory = (category: ChaletRoomCategory) => {
        setEditingCategoryId(category.id);
        setCategoryForm({
            name: category.name,
            description: category.description || '',
            area_sqm: category.area_sqm ? String(category.area_sqm) : '',
            room_count: category.room_count,
            max_adults: category.max_adults,
            max_children: category.max_children,
            max_guests: category.max_guests,
            bed_configurations: Array.isArray(category.bed_configurations) ? category.bed_configurations : [],
            bathroom_features: normalizeFacilityItems(category.bathroom_features, 'shower'),
            entertainment_features: normalizeFacilityItems(category.entertainment_features, 'tv'),
            general_amenities: normalizeFacilityItems(category.general_amenities, 'check'),
            internet_features: normalizeFacilityItems(category.internet_features, 'wifi'),
            image_urls: normalizeImageUrls(category.image_urls),
            sort_order: category.sort_order,
            is_active: category.is_active,
        });
        setCategoryDialogOpen(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryForm.name.trim()) {
            toast({ title: 'Validation', description: 'Room category name is required', variant: 'destructive' });
            return;
        }
        setSavingCategory(true);
        try {
            const payload = {
                ...categoryForm,
                area_sqm: categoryForm.area_sqm ? Number(categoryForm.area_sqm) : null,
                bed_configurations: categoryForm.bed_configurations.map(item => item.trim()).filter(Boolean),
                bathroom_features: categoryForm.bathroom_features.filter(item => item.name.trim()),
                entertainment_features: categoryForm.entertainment_features.filter(item => item.name.trim()),
                general_amenities: categoryForm.general_amenities.filter(item => item.name.trim()),
                internet_features: categoryForm.internet_features.filter(item => item.name.trim()),
                image_urls: normalizeImageUrls(categoryForm.image_urls),
                ...(editingCategoryId ? { id: editingCategoryId } : {}),
            };
            const res = await fetch('/api/chalet/room-categories', {
                method: editingCategoryId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: editingCategoryId ? 'Room category updated' : 'Room category created' });
            setCategoryDialogOpen(false);
            fetchRooms();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSavingCategory(false);
        }
    };

    const handleCategoryActiveChange = async (category: ChaletRoomCategory, isActive: boolean) => {
        setCategoryStatusUpdating(category.id);
        try {
            const res = await fetch('/api/chalet/room-categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...category, is_active: isActive }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCategories(prev => prev.map(item => item.id === category.id ? { ...item, is_active: isActive } : item));
            toast({ title: 'Category Updated', description: `${category.name} is now ${isActive ? 'active' : 'inactive'}` });
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setCategoryStatusUpdating(null);
        }
    };

    const handleDeleteCategory = async () => {
        if (!deleteCategoryId) return;
        setDeletingCategory(true);
        try {
            const res = await fetch(`/api/chalet/room-categories?id=${deleteCategoryId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Deleted', description: 'Room category deleted' });
            setDeleteCategoryId(null);
            fetchRooms();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setDeletingCategory(false);
        }
    };

    const applyCategoryToRoomForm = (categoryId: string) => {
        if (categoryId === '__none__') {
            setForm(p => ({ ...p, category_id: '' }));
            return;
        }
        const category = categories.find(item => item.id === categoryId);
        setForm(p => ({
            ...p,
            category_id: categoryId,
            max_adults: category ? String(category.max_adults) : p.max_adults,
            max_children: category ? String(category.max_children) : p.max_children,
            max_guests: category ? String(category.max_guests) : p.max_guests,
            bed_type: category?.bed_configurations?.[0] || p.bed_type,
            description: category?.description || p.description,
        }));
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
    const filteredRooms = rooms.filter(room => {
        const search = roomSearch.trim().toLowerCase();
        const matchesSearch = !search || [
            room.name,
            room.room_number,
            room.floor,
            room.description,
            room.bed_type,
            room.chalet_room_categories?.name,
        ].some(value => String(value || '').toLowerCase().includes(search));
        const matchesStatus = roomStatusFilter === 'all' || room.status === roomStatusFilter;
        const matchesCategory = roomCategoryFilter === 'all'
            || (roomCategoryFilter === '__none__' ? !room.category_id : room.category_id === roomCategoryFilter);
        return matchesSearch && matchesStatus && matchesCategory;
    });
    const resetRoomFilters = () => {
        setRoomSearch('');
        setRoomStatusFilter('all');
        setRoomCategoryFilter('all');
    };

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Chalet Rooms</h1>
                    <p className="text-sm text-muted-foreground">Manage room categories, availability, capacity, and room details from one clean workspace.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex">
                    <div className="rounded-lg border bg-card px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">Rooms</p>
                        <p className="text-xl font-bold">{loading ? '-' : rooms.length}</p>
                    </div>
                    <div className="rounded-lg border bg-card px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">Categories</p>
                        <p className="text-xl font-bold">{loading ? '-' : categories.length}</p>
                    </div>
                    <div className="rounded-lg border bg-card px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">Available</p>
                        <p className="text-xl font-bold">{loading ? '-' : rooms.filter(room => room.status === 'available').length}</p>
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30 pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base">Room Categories</CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">Set the room type once, then apply capacity, beds, facilities, and images to rooms.</p>
                        </div>
                        <Button variant="outline" onClick={openNewCategory} className="w-full gap-2 sm:w-auto">
                            <Plus className="h-4 w-4" />
                            Add Category
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    {loading ? (
                        <div className="grid gap-3 md:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-lg border p-4">
                                    <Skeleton className="h-5 w-36" />
                                    <Skeleton className="mt-2 h-4 w-28" />
                                    <Skeleton className="mt-4 h-9 w-full" />
                                </div>
                            ))}
                        </div>
                    ) : categories.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {categories.map(category => (
                                <div key={category.id} className={`rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 ${!category.is_active ? 'opacity-70' : ''}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate font-semibold">{category.name}</h3>
                                                <Badge variant="outline" className={category.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'}>
                                                    {category.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">{category.room_count} room(s) · Max {category.max_guests} guests</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => openEditCategory(category)} aria-label={`Edit ${category.name}`}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteCategoryId(category.id)} aria-label={`Delete ${category.name}`}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                                        <div>
                                            <p className="text-xs font-medium">Show for booking</p>
                                            <p className="text-[11px] text-muted-foreground">{categoryStatusUpdating === category.id ? 'Updating...' : category.is_active ? 'Available to use' : 'Hidden from use'}</p>
                                        </div>
                                        <Switch
                                            checked={category.is_active}
                                            onCheckedChange={checked => handleCategoryActiveChange(category, checked)}
                                            disabled={categoryStatusUpdating === category.id}
                                            aria-label={`${category.is_active ? 'Deactivate' : 'Activate'} ${category.name}`}
                                        />
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-md bg-muted/50 px-2 py-2">
                                            <p className="text-[11px] font-medium text-muted-foreground">Adults</p>
                                            <p className="font-semibold">{category.max_adults}</p>
                                        </div>
                                        <div className="rounded-md bg-muted/50 px-2 py-2">
                                            <p className="text-[11px] font-medium text-muted-foreground">Children</p>
                                            <p className="font-semibold">{category.max_children}</p>
                                        </div>
                                        <div className="rounded-md bg-muted/50 px-2 py-2">
                                            <p className="text-[11px] font-medium text-muted-foreground">Guests</p>
                                            <p className="font-semibold">{category.max_guests}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex min-h-6 flex-wrap gap-2">
                                        {category.bed_configurations?.slice(0, 2).map(bed => (
                                            <Badge key={bed} variant="outline" className="font-normal">
                                                <Bed className="mr-1 h-3 w-3" />
                                                {bed}
                                            </Badge>
                                        ))}
                                    </div>
                                    <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => { setInfoCategory(category); setInfoImageIndex(0); }}>
                                        <Info className="mr-2 h-3.5 w-3.5" />
                                        View Details
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                            <p className="font-medium">No room categories yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">Create categories before adding rooms for a faster setup.</p>
                            <Button size="sm" className="mt-4 gap-2" onClick={openNewCategory}>
                                <Plus className="h-4 w-4" />
                                Add Category
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30 pb-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <CardTitle className="text-base">Room Operations</CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">Review status, find rooms quickly, and update availability.</p>
                        </div>
                        <Button onClick={openCreate} className="w-full gap-2 sm:w-auto">
                            <Plus className="h-4 w-4" />
                            Add Chalet Room
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {statusCounts.map(({ status, count }) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setRoomStatusFilter(status)}
                                className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${roomStatusFilter === status ? 'border-primary bg-primary/5' : 'bg-background'}`}
                            >
                                <p className="text-xs font-medium text-muted-foreground">{statusConfig[status].label}</p>
                                <p className="mt-1 text-2xl font-bold">{loading ? '-' : count}</p>
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(220px,1fr)_180px_220px_auto]">
                        <div className="space-y-1">
                            <Label>Search Rooms</Label>
                            <Input
                                value={roomSearch}
                                onChange={event => setRoomSearch(event.target.value)}
                                placeholder="Room name, number, floor, category"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Select value={roomStatusFilter} onValueChange={value => setRoomStatusFilter(value as 'all' | ChaletRoomStatus)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    {(Object.keys(statusConfig) as ChaletRoomStatus[]).map(status => (
                                        <SelectItem key={status} value={status}>{statusConfig[status].label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Category</Label>
                            <Select value={roomCategoryFilter} onValueChange={setRoomCategoryFilter}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="__none__">No Category</SelectItem>
                                    {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={resetRoomFilters}>
                                Reset
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium">Rooms</p>
                        <p className="text-sm text-muted-foreground">Showing {filteredRooms.length} of {rooms.length} room(s)</p>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-full" /></CardContent></Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredRooms.map(room => (
                        <Card key={room.id} className="relative overflow-hidden transition-colors hover:border-primary/40">
                            <div className={`h-1 ${room.status === 'available' ? 'bg-green-500' : room.status === 'occupied' ? 'bg-red-500' : room.status === 'cleaning' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <CardTitle className="text-base">{room.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">Room #{room.room_number}{room.floor ? ` · Floor ${room.floor}` : ''}</p>
                                        {room.chalet_room_categories && <p className="text-xs text-muted-foreground">{room.chalet_room_categories.name}</p>}
                                    </div>
                                    <Button size="icon" variant="ghost" onClick={() => openEdit(room)} aria-label={`Edit ${room.name}`}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {room.description && (
                                    <p className="text-xs text-muted-foreground">{room.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {(room.max_guests || room.chalet_room_categories?.max_guests) && (
                                        <Badge variant="outline" className="text-xs font-normal">
                                            <Users className="mr-1 h-3 w-3" />
                                            Max {room.max_guests || room.chalet_room_categories?.max_guests}
                                        </Badge>
                                    )}
                                    {(room.bed_type || room.chalet_room_categories?.bed_configurations?.[0]) && (
                                        <Badge variant="outline" className="text-xs font-normal">
                                            <Bed className="mr-1 h-3 w-3" />
                                            {room.bed_type || room.chalet_room_categories?.bed_configurations?.[0]}
                                        </Badge>
                                    )}
                                </div>
                                {room.notes && (
                                    <p className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">{room.notes}</p>
                                )}
                                <div className="flex items-center justify-between gap-2">
                                    <Badge
                                        variant="outline"
                                        className={`text-xs border ${statusConfig[room.status].className}`}
                                    >
                                        {statusConfig[room.status].label}
                                    </Badge>
                                    {statusUpdating === room.id && <span className="text-xs text-muted-foreground">Updating...</span>}
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
                    {filteredRooms.length === 0 && (
                        <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                            <CardContent className="flex min-h-32 flex-col items-center justify-center gap-2 p-6 text-center">
                                <p className="font-medium">No rooms match these filters</p>
                                <p className="text-sm text-muted-foreground">Try another room number, category, or status.</p>
                                <Button type="button" variant="outline" size="sm" onClick={resetRoomFilters}>Reset Filters</Button>
                            </CardContent>
                        </Card>
                    )}
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
                        <div className="space-y-1">
                            <Label>Room Category</Label>
                            <Select value={form.category_id || '__none__'} onValueChange={applyCategoryToRoomForm}>
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No Category</SelectItem>
                                    {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <Label>Adults</Label>
                                <Input type="number" min={0} value={form.max_adults} onChange={e => setForm(p => ({ ...p, max_adults: e.target.value }))} placeholder="Category" />
                            </div>
                            <div className="space-y-1">
                                <Label>Children</Label>
                                <Input type="number" min={0} value={form.max_children} onChange={e => setForm(p => ({ ...p, max_children: e.target.value }))} placeholder="Category" />
                            </div>
                            <div className="space-y-1">
                                <Label>Guests</Label>
                                <Input type="number" min={0} value={form.max_guests} onChange={e => setForm(p => ({ ...p, max_guests: e.target.value }))} placeholder="Category" />
                            </div>
                            <div className="space-y-1">
                                <Label>Bed Type</Label>
                                <Input value={form.bed_type} onChange={e => setForm(p => ({ ...p, bed_type: e.target.value }))} placeholder="1 King" />
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

            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingCategoryId ? 'Edit Room Category' : 'Add Room Category'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1 md:col-span-2">
                                <Label>Category Name *</Label>
                                <Input value={categoryForm.name} onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))} placeholder="Superior Duplex King" />
                            </div>
                            <div className="space-y-1">
                                <Label>Room Count</Label>
                                <Input type="number" min={1} value={categoryForm.room_count} onChange={e => setCategoryForm(p => ({ ...p, room_count: parseInt(e.target.value) || 1 }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea rows={4} value={categoryForm.description} onChange={e => setCategoryForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the room type..." />
                        </div>
                        <div className="grid gap-4 md:grid-cols-5">
                            <div className="space-y-1">
                                <Label>Area sqm</Label>
                                <Input type="number" min={0} value={categoryForm.area_sqm} onChange={e => setCategoryForm(p => ({ ...p, area_sqm: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Adults Max</Label>
                                <Input type="number" min={0} value={categoryForm.max_adults} onChange={e => setCategoryForm(p => ({ ...p, max_adults: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Children Max</Label>
                                <Input type="number" min={0} value={categoryForm.max_children} onChange={e => setCategoryForm(p => ({ ...p, max_children: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Guests Max</Label>
                                <Input type="number" min={0} value={categoryForm.max_guests} onChange={e => setCategoryForm(p => ({ ...p, max_guests: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Sort</Label>
                                <Input type="number" value={categoryForm.sort_order} onChange={e => setCategoryForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                            <div>
                                <Label>Active Category</Label>
                                <p className="text-xs text-muted-foreground">Inactive categories stay saved but can be hidden from new setup workflows.</p>
                            </div>
                            <Switch
                                checked={categoryForm.is_active}
                                onCheckedChange={checked => setCategoryForm(p => ({ ...p, is_active: checked }))}
                                aria-label="Category active status"
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <ImageUrlEditor
                                urls={categoryForm.image_urls}
                                onChange={urls => setCategoryForm(p => ({ ...p, image_urls: urls }))}
                            />
                            <BeddingConfigurationEditor
                                items={categoryForm.bed_configurations}
                                onChange={items => setCategoryForm(p => ({ ...p, bed_configurations: items }))}
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FacilityEditor
                                title="Bathroom Features"
                                items={categoryForm.bathroom_features}
                                defaultIcon="shower"
                                onChange={items => setCategoryForm(p => ({ ...p, bathroom_features: items }))}
                            />
                            <FacilityEditor
                                title="Entertainment"
                                items={categoryForm.entertainment_features}
                                defaultIcon="tv"
                                onChange={items => setCategoryForm(p => ({ ...p, entertainment_features: items }))}
                            />
                            <FacilityEditor
                                title="General Amenities"
                                items={categoryForm.general_amenities}
                                defaultIcon="check"
                                onChange={items => setCategoryForm(p => ({ ...p, general_amenities: items }))}
                            />
                            <FacilityEditor
                                title="Internet"
                                items={categoryForm.internet_features}
                                defaultIcon="wifi"
                                onChange={items => setCategoryForm(p => ({ ...p, internet_features: items }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveCategory} disabled={savingCategory}>{savingCategory ? 'Saving...' : 'Save Category'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteCategoryId} onOpenChange={open => !open && setDeleteCategoryId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Room Category?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the room category. If rooms or rates are still using it, the database may block the delete.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingCategory}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCategory}
                            disabled={deletingCategory}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletingCategory ? 'Deleting...' : 'Delete Category'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!infoCategory} onOpenChange={open => !open && setInfoCategory(null)}>
                <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto border-0 p-0">
                    {infoCategory && (
                        <div className="bg-white p-6 text-black sm:p-10">
                            <DialogHeader className="mb-8">
                                <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-normal text-black">
                                    <span>{infoCategory.name}</span>
                                    <span className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-100 px-3 text-base font-semibold">
                                        <User className="h-5 w-5" />
                                        {infoCategory.max_guests}
                                    </span>
                                    {infoCategory.area_sqm ? (
                                        <span className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-100 px-3 text-base font-semibold">
                                            <Ruler className="h-5 w-5" />
                                            {Number(infoCategory.area_sqm).toLocaleString('en-LK')} sq mtr
                                        </span>
                                    ) : null}
                                    <span className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-100 px-3 text-base font-semibold">
                                        <BedDouble className="h-5 w-5" />
                                        {infoCategory.bed_configurations?.[0] || 'Beds'}
                                    </span>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
                                <div>
                                    {infoCategory.image_urls?.length > 0 ? (
                                        <div className="relative aspect-[4/2.8] overflow-hidden bg-gray-100">
                                            <img
                                                src={infoCategory.image_urls[Math.min(infoImageIndex, infoCategory.image_urls.length - 1)]}
                                                alt={infoCategory.name}
                                                className="h-full w-full object-cover"
                                            />
                                            {infoCategory.image_urls.length > 1 && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white"
                                                        onClick={() => setInfoImageIndex(current => (current - 1 + infoCategory.image_urls.length) % infoCategory.image_urls.length)}
                                                        aria-label="Previous image"
                                                    >
                                                        <ChevronLeft className="h-7 w-7" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white"
                                                        onClick={() => setInfoImageIndex(current => (current + 1) % infoCategory.image_urls.length)}
                                                        aria-label="Next image"
                                                    >
                                                        <ChevronRight className="h-7 w-7" />
                                                    </button>
                                                </>
                                            )}
                                            <span className="absolute bottom-4 left-4 rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white">Images</span>
                                        </div>
                                    ) : (
                                        <div className="flex aspect-[4/2.8] items-center justify-center bg-gray-100 text-gray-500">
                                            <Images className="mr-2 h-6 w-6" /> Images
                                        </div>
                                    )}
                                </div>

                                <div className="pt-1">
                                    {infoCategory.description ? (
                                        <p className="text-lg leading-9 text-black">{infoCategory.description}</p>
                                    ) : (
                                        <p className="text-lg leading-9 text-gray-500">No room description has been added yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-16">
                                <h3 className="text-2xl font-bold">Facilities</h3>
                                <div className="mt-5 grid gap-x-14 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
                                    <FacilityGroup title="Bathroom Features" items={infoCategory.bathroom_features} kind="bathroom" />
                                    <FacilityGroup title="Entertainment" items={infoCategory.entertainment_features} kind="entertainment" />
                                    <FacilityGroup title="General Amenities" items={infoCategory.general_amenities} kind="amenities" />
                                    <FacilityGroup title="Internet" items={infoCategory.internet_features} kind="internet" />
                                </div>
                            </div>

                            {infoCategory.bed_configurations?.length > 0 && (
                                <div className="mt-10">
                                    <h3 className="text-2xl font-bold">Bedding Configuration</h3>
                                    <p className="mt-5 text-lg text-black">{infoCategory.bed_configurations.join(' or ')}</p>
                                </div>
                            )}

                            <div className="mt-10 grid max-w-xl gap-3 border-t pt-6 text-lg">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-3 text-gray-700"><User className="h-5 w-5" />Adults</span>
                                    <span className="font-bold">MAX {infoCategory.max_adults}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-3 text-gray-700"><Users className="h-5 w-5" />Children</span>
                                    <span className="font-bold">MAX {infoCategory.max_children}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-3 text-gray-700"><Users className="h-5 w-5" />Guests Allowed</span>
                                    <span className="font-bold">MAX {infoCategory.max_guests}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function selectedIcon(icon: unknown) {
    return facilityIconOptions.find(option => option.key === icon)?.icon || Check;
}

type FacilityKind = 'bathroom' | 'entertainment' | 'amenities' | 'internet';

function fallbackIcon(kind: FacilityKind, item: string) {
    const lower = item.toLowerCase();
    if (kind === 'bathroom') return lower.includes('bath') ? 'bath' : 'shower';
    if (kind === 'internet') return 'wifi';
    if (kind === 'entertainment') return lower.includes('dvd') || lower.includes('player') ? 'play' : 'tv';
    if (lower.includes('dryer')) return 'wind';
    if (lower.includes('bed')) return 'bed';
    return 'check';
}

function FacilityGroup({ title, items, kind }: { title: string; items?: unknown[]; kind: FacilityKind }) {
    const normalized = normalizeFacilityItems(items, 'check').map(item => ({
        ...item,
        icon: item.icon || fallbackIcon(kind, item.name),
    }));
    if (!normalized.length) return null;
    return (
        <div>
            <h4 className="mb-3 text-xl font-bold">{title}</h4>
            <ul className="space-y-3">
                {normalized.map(item => {
                    const Icon = selectedIcon(item.icon);
                    return (
                        <li key={`${item.icon}-${item.name}`} className="flex items-center gap-3 text-lg">
                            <Icon className="h-5 w-5 shrink-0 text-black" />
                            <span>{item.name}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function FacilityEditor({ title, items, defaultIcon, onChange }: { title: string; items: FacilityItem[]; defaultIcon: FacilityIconKey; onChange: (items: FacilityItem[]) => void }) {
    const updateItem = (index: number, patch: Partial<FacilityItem>) => {
        onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    };
    const addItem = () => onChange([...items, { name: '', icon: defaultIcon }]);
    const removeItem = (index: number) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

    return (
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
                <Label>{title}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                </Button>
            </div>
            <div className="space-y-2">
                {items.map((item, index) => {
                    const Icon = selectedIcon(item.icon);
                    return (
                        <div key={index} className="grid grid-cols-[1fr_128px_32px] gap-2">
                            <Input value={item.name} onChange={event => updateItem(index, { name: event.target.value })} placeholder="Facility name" />
                            <Select value={item.icon} onValueChange={value => updateItem(index, { icon: value as FacilityIconKey })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {facilityIconOptions.map(option => {
                                        const OptionIcon = option.icon;
                                        return (
                                            <SelectItem key={option.key} value={option.key}>
                                                <span className="inline-flex items-center gap-2">
                                                    <OptionIcon className="h-4 w-4" />
                                                    {option.label}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} aria-label={`Remove ${item.name || 'facility'}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    );
                })}
                {items.length === 0 && (
                    <button type="button" onClick={addItem} className="flex h-10 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        <Plus className="mr-2 h-4 w-4" />
                        Add first facility
                    </button>
                )}
            </div>
        </div>
    );
}

function BeddingConfigurationEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
    const updateItem = (index: number, value: string) => onChange(items.map((item, itemIndex) => itemIndex === index ? value : item));
    const addItem = () => onChange([...items, '']);
    const removeItem = (index: number) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

    return (
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
                <Label>Bedding Configuration</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                </Button>
            </div>
            <div className="space-y-2">
                {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_32px] gap-2">
                        <Input
                            value={item}
                            onChange={event => updateItem(index, event.target.value)}
                            placeholder="1 King"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} aria-label={`Remove bedding option ${index + 1}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                {items.length === 0 && (
                    <button type="button" onClick={addItem} className="flex h-10 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        <Plus className="mr-2 h-4 w-4" />
                        Add first bedding option
                    </button>
                )}
            </div>
        </div>
    );
}

function ImageUrlEditor({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
    const visibleUrls = urls.slice(0, 3);
    const canUploadMore = visibleUrls.length < 3;
    const removeUrl = (index: number) => onChange(urls.filter((_, urlIndex) => urlIndex !== index));
    const readImageFile = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
        event.target.value = '';
        if (!files.length || !canUploadMore) return;
        const remainingSlots = 3 - visibleUrls.length;
        const imageDataUrls = await Promise.all(files.slice(0, remainingSlots).map(readImageFile));
        onChange([...visibleUrls, ...imageDataUrls].slice(0, 3));
    };

    return (
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <Label>Images</Label>
                    <p className="text-xs text-muted-foreground">{visibleUrls.length}/3 uploaded</p>
                </div>
                <Label className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium ${canUploadMore ? 'cursor-pointer bg-background hover:bg-accent' : 'cursor-not-allowed opacity-50'}`}>
                    <Images className="mr-1 h-3 w-3" />
                    Upload
                    <Input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!canUploadMore}
                        className="hidden"
                        onChange={handleUpload}
                    />
                </Label>
            </div>
            <div className="space-y-2">
                {visibleUrls.map((url, index) => (
                    <div key={index} className="grid grid-cols-[96px_1fr_32px] gap-2">
                        <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
                            <img src={url} alt={`Room image ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex min-w-0 items-center">
                            <p className="truncate text-sm font-medium">Image {index + 1}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeUrl(index)} aria-label={`Remove image ${index + 1}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                {visibleUrls.length === 0 && (
                    <label className="flex h-20 w-full cursor-pointer items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/50">
                        <Plus className="mr-2 h-4 w-4" />
                        Upload first image
                        <Input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                    </label>
                )}
            </div>
        </div>
    );
}
