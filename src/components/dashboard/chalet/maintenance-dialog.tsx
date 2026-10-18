'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ChaletRoom } from '@/lib/types';
import { describeBlock } from '@/lib/chalet-stay';

export type ChaletRoomBlock = {
    id: string;
    room_id: string;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
    reason: string | null;
    created_at?: string;
    room?: { name?: string; room_number?: string } | null;
    user?: { name?: string } | null;
};

const formatDay = (value: string) => format(parseISO(`${value}T00:00:00`), 'dd MMM yyyy');

// "01" → "Chalet 01"; a room number already saved as "Chalet 01" stays as is.
export function chaletLabel(roomNumber: string | number | null | undefined) {
    const value = String(roomNumber ?? '').trim();
    if (!value) return 'Chalet ?';
    return /^chalet\b/i.test(value) ? value : `Chalet ${value}`;
}

// Schedule maintenance for chalets. Existing records are listed in the
// Maintenance tab of Chalet Bookings.
export function MaintenanceDialog({ open, onOpenChange, rooms, onChanged }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rooms: ChaletRoom[];
    onChanged: () => void;
}) {
    const { toast } = useToast();
    const [roomIds, setRoomIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    // Whole days (00:00–23:59) or specific hours.
    const [wholeDay, setWholeDay] = useState(true);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [conflicts, setConflicts] = useState<{ booking_ref: string; customer_name: string; check_in_date: string; check_out_date: string }[]>([]);

    const today = new Date().toISOString().slice(0, 10);
    const sortedRooms = [...rooms].sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));

    const reset = () => { setRoomIds([]); setStartDate(''); setEndDate(''); setReason(''); setConflicts([]); setWholeDay(true); setStartTime('09:00'); setEndTime('17:00'); };
    const chosenStart = wholeDay ? '00:00' : startTime;
    const chosenEnd = wholeDay ? '23:59' : endTime;

    const save = async (force = false) => {
        setSaving(true);
        try {
            const res = await fetch('/api/chalet/room-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_ids: roomIds, start_date: startDate, end_date: endDate, start_time: chosenStart, end_time: chosenEnd, reason, force }),
            });
            const data = await res.json();
            if (res.status === 409 && Array.isArray(data.conflicts)) {
                setConflicts(data.conflicts);
                return;
            }
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Maintenance scheduled', description: `${roomIds.length} chalet(s) closed ${describeBlock({ start_date: startDate, end_date: endDate, start_time: chosenStart, end_time: chosenEnd }, formatDay)}.` });
            reset();
            onChanged();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Could not schedule maintenance', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const valid = roomIds.length > 0 && startDate && endDate && endDate >= startDate
        && `${endDate}T${chosenEnd}` > `${startDate}T${chosenStart}`;

    return (
        <Dialog open={open} onOpenChange={value => { if (!value) reset(); onOpenChange(value); }}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Chalet Maintenance</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 rounded-md border p-4">
                    <p className="text-sm font-semibold">Close chalets for maintenance</p>
                    <div className="space-y-1">
                        <Label>Chalets</Label>
                        <div className="flex flex-wrap gap-3">
                            {sortedRooms.map(room => (
                                <label key={room.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                                    <Checkbox
                                        checked={roomIds.includes(room.id)}
                                        onCheckedChange={checked => setRoomIds(current => checked ? [...current, room.id] : current.filter(id => id !== room.id))}
                                    />
                                    {chaletLabel(room.room_number)}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label>From (first day)</Label>
                            <Input type="date" min={today} value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); setConflicts([]); }} />
                        </div>
                        <div className="space-y-1">
                            <Label>To (last day)</Label>
                            <Input type="date" min={startDate || today} value={endDate} onChange={e => { setEndDate(e.target.value); setConflicts([]); }} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={wholeDay} onCheckedChange={checked => { setWholeDay(Boolean(checked)); setConflicts([]); }} />
                            Whole day{startDate && endDate && startDate !== endDate ? 's' : ''} (12:00 AM – 11:59 PM)
                        </label>
                        {!wholeDay && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Start time (on the first day)</Label>
                                    <Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setConflicts([]); }} />
                                </div>
                                <div className="space-y-1">
                                    <Label>End time (on the last day)</Label>
                                    <Input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); setConflicts([]); }} />
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">Bookings whose stay hours (check-in time to check-out time) overlap these hours can&apos;t use the chalet.</p>
                    </div>
                    <div className="space-y-1">
                        <Label>Reason</Label>
                        <Input placeholder="e.g. Painting, plumbing repair" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>

                    {conflicts.length > 0 && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" /> These bookings already use the selected chalets on those days:</p>
                            <ul className="mt-1 list-disc pl-5 text-xs">
                                {conflicts.map(conflict => (
                                    <li key={conflict.booking_ref}>{conflict.customer_name} · {conflict.booking_ref} · {formatDay(conflict.check_in_date)} → {formatDay(conflict.check_out_date)}</li>
                                ))}
                            </ul>
                            <p className="mt-1 text-xs">Move those bookings to another chalet first, or schedule anyway.</p>
                            <Button size="sm" variant="outline" className="mt-2" disabled={saving} onClick={() => void save(true)}>Schedule anyway</Button>
                        </div>
                    )}

                    <Button onClick={() => void save(false)} disabled={!valid || saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Close {roomIds.length || ''} chalet{roomIds.length === 1 ? '' : 's'} for maintenance
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
