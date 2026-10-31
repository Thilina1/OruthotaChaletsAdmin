'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Shirt, UtensilsCrossed, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { calcPackageCharges } from '@/lib/buffet-invoice';
import { serviceInvoiceNumber } from '@/lib/utils';
import type { BuffetPackage, ServiceLineItemMaster } from '@/lib/types';

// Extras added on a chalet booking or at check-in: experiences, services and
// buffet bookings. They are collected here and saved with the booking (or
// check-in) by saveBookingExtras; every one is charged to the room bill.

export type PendingExperience = { name: string; people: number; rate: number };
export type PendingService = { service_type: string; description: string; amount: number; master_id?: string };
export type PendingBuffet = { date: string; meal_type: string; guests: number; package_id: string | null; package_name?: string; estimate?: number };
export type PendingExtras = { experiences: PendingExperience[]; services: PendingService[]; buffets: PendingBuffet[] };

export const emptyExtras: PendingExtras = { experiences: [], services: [], buffets: [] };

export const hasPendingExtras = (extras: PendingExtras) =>
    extras.experiences.length + extras.services.length + extras.buffets.length > 0;

export async function saveBookingExtras(bookingId: string, extras: PendingExtras, customerId?: string | null) {
    if (!hasPendingExtras(extras)) return null;
    const response = await fetch(`/api/chalet/bookings/${encodeURIComponent(bookingId)}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extras, customer_id: customerId || null }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to add extras.');
    return data;
}

const SERVICE_TYPES = [
    { value: 'Laundry', label: 'Laundry' },
    { value: 'Transport & Excursion', label: 'Transport & Excursion' },
    { value: 'Spa/Pool', label: 'Spa & Pool' },
];

type SavedExtra = {
    id: string;
    invoice_number?: string | null;
    service_type: string;
    description: string;
    amount: number;
    date: string;
    payment_status: 'add_to_bill' | 'paid';
    room_number?: string | null;
};

const money = (value: number) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BookingExtras({ bookingId, pending, onPendingChange, defaultPeople = 1, stayFrom, stayTo }: {
    bookingId?: string | null;
    pending: PendingExtras;
    onPendingChange: (extras: PendingExtras) => void;
    defaultPeople?: number;
    stayFrom?: string;
    stayTo?: string;
}) {
    const { toast } = useToast();
    const [tab, setTab] = useState<'experience' | 'service' | 'buffet'>('experience');
    const [masters, setMasters] = useState<ServiceLineItemMaster[]>([]);
    const [packages, setPackages] = useState<BuffetPackage[]>([]);
    const [saved, setSaved] = useState<SavedExtra[]>([]);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const people = String(Math.max(1, defaultPeople));
    const [experience, setExperience] = useState({ master_id: '', people, rate: '' });
    const [service, setService] = useState({ service_type: 'Laundry', master_id: '', description: '', amount: '', quantity: '1' });
    const [buffet, setBuffet] = useState({ date: stayFrom || '', meal_type: 'dinner', guests: people, package_id: '' });

    useEffect(() => {
        fetch('/api/admin/service-line-items?active=true').then(r => r.json()).then(d => setMasters(d.items || [])).catch(() => undefined);
        fetch('/api/buffet/packages').then(r => r.json()).then(d => setPackages((d.packages || []).filter((p: BuffetPackage) => p.is_active))).catch(() => undefined);
    }, []);

    const loadSaved = () => {
        if (!bookingId) { setSaved([]); return; }
        setIsLoadingSaved(true);
        fetch(`/api/chalet/bookings/${encodeURIComponent(bookingId)}/extras`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => setSaved(d.extras || []))
            .catch(() => setSaved([]))
            .finally(() => setIsLoadingSaved(false));
    };
    useEffect(loadSaved, [bookingId]);

    // Keep the defaults in step with the booking's guests and dates.
    useEffect(() => {
        setExperience(current => ({ ...current, people }));
        setBuffet(current => ({ ...current, guests: people }));
    }, [people]);
    useEffect(() => {
        setBuffet(current => ({ ...current, date: current.date && (!stayFrom || current.date >= stayFrom) && (!stayTo || current.date <= stayTo) ? current.date : stayFrom || '' }));
    }, [stayFrom, stayTo]);

    const experienceMasters = masters.filter(m => m.service_type === 'Experience');
    const serviceMasters = masters.filter(m => m.service_type === service.service_type);
    const selectedPackage = packages.find(p => p.id === buffet.package_id);
    const buffetEstimate = selectedPackage ? calcPackageCharges(selectedPackage, Number(buffet.guests) || 0).total : 0;

    const pendingTotal = useMemo(() =>
        pending.experiences.reduce((sum, item) => sum + item.people * item.rate, 0)
        + pending.services.reduce((sum, item) => sum + item.amount, 0)
        + pending.buffets.reduce((sum, item) => sum + (item.estimate || 0), 0),
    [pending]);

    const addExperience = () => {
        const master = experienceMasters.find(m => m.id === experience.master_id);
        const count = Number(experience.people);
        if (!master || !Number.isInteger(count) || count < 1 || Number(experience.rate) < 0) {
            toast({ variant: 'destructive', title: 'Experience', description: 'Choose an experience and enter the number of people.' });
            return;
        }
        onPendingChange({ ...pending, experiences: [...pending.experiences, { name: master.name, people: count, rate: Number(experience.rate) || 0 }] });
        setExperience({ master_id: '', people, rate: '' });
    };

    const addService = () => {
        const master = serviceMasters.find(m => m.id === service.master_id);
        const quantity = Math.max(1, Number(service.quantity) || 1);
        const name = master?.name || service.description.trim();
        const unit = Number(service.amount);
        if (!name || service.amount === '' || unit < 0) {
            toast({ variant: 'destructive', title: 'Service', description: 'Choose an item (or type one) and enter the amount.' });
            return;
        }
        onPendingChange({
            ...pending,
            services: [...pending.services, {
                service_type: service.service_type,
                description: quantity > 1 ? `${name} × ${quantity}` : name,
                amount: Math.round(unit * quantity * 100) / 100,
                ...(master ? { master_id: master.id } : {}),
            }],
        });
        setService(current => ({ ...current, master_id: '', description: '', amount: '', quantity: '1' }));
    };

    const addBuffet = () => {
        const guests = Number(buffet.guests);
        if (!buffet.date || !Number.isInteger(guests) || guests < 1) {
            toast({ variant: 'destructive', title: 'Buffet', description: 'Choose a date and enter the number of guests.' });
            return;
        }
        onPendingChange({
            ...pending,
            buffets: [...pending.buffets, {
                date: buffet.date,
                meal_type: buffet.meal_type,
                guests,
                package_id: selectedPackage?.id || null,
                package_name: selectedPackage?.name,
                estimate: buffetEstimate,
            }],
        });
        setBuffet(current => ({ ...current, package_id: '' }));
    };

    const removePending = (kind: keyof PendingExtras, index: number) =>
        onPendingChange({ ...pending, [kind]: (pending[kind] as any[]).filter((_, i) => i !== index) });

    const removeSaved = async (extra: SavedExtra) => {
        if (!bookingId) return;
        setRemovingId(extra.id);
        try {
            const response = await fetch(`/api/chalet/bookings/${encodeURIComponent(bookingId)}/extras?income_id=${encodeURIComponent(extra.id)}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not remove this extra.');
            setSaved(current => current.filter(item => item.id !== extra.id));
            toast({ title: 'Removed', description: `${extra.service_type}: ${extra.description} was taken off the room bill.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Not removed', description: error.message });
        } finally {
            setRemovingId(null);
        }
    };

    const tabs = [
        { value: 'experience', label: 'Experience', icon: Sparkles },
        { value: 'service', label: 'Service', icon: Shirt },
        { value: 'buffet', label: 'Buffet', icon: UtensilsCrossed },
    ] as const;

    return (
        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold">Extras</h3>
                    <p className="text-xs text-muted-foreground">Experiences, services and buffets are added to the guest's room bill and paid at check-out.</p>
                </div>
                <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
                    {tabs.map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTab(value)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'experience' && (
                <div className="grid gap-2 sm:grid-cols-[1fr_90px_130px_auto] sm:items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">Experience</Label>
                        <Select value={experience.master_id || undefined} onValueChange={value => {
                            const master = experienceMasters.find(m => m.id === value);
                            setExperience(current => ({ ...current, master_id: value, rate: master ? String(Number(master.default_amount || 0)) : current.rate }));
                        }}>
                            <SelectTrigger><SelectValue placeholder={experienceMasters.length ? 'Select experience' : 'No experiences in Service Line Items'} /></SelectTrigger>
                            <SelectContent>
                                {experienceMasters.map(m => <SelectItem key={m.id} value={m.id}>{m.name} — {money(Number(m.default_amount || 0))} / person</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">People</Label>
                        <Input type="number" min={1} step={1} value={experience.people} onChange={e => setExperience(c => ({ ...c, people: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Rate / person</Label>
                        <Input type="number" min={0} step="0.01" value={experience.rate} onChange={e => setExperience(c => ({ ...c, rate: e.target.value }))} />
                    </div>
                    <Button type="button" variant="outline" onClick={addExperience}><Plus className="mr-1 h-4 w-4" />Add</Button>
                </div>
            )}

            {tab === 'service' && (
                <div className="grid gap-2 sm:grid-cols-[150px_1fr_70px_120px_auto] sm:items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">Service</Label>
                        <Select value={service.service_type} onValueChange={value => setService(c => ({ ...c, service_type: value, master_id: '', description: '', amount: '' }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Item</Label>
                        <Select value={service.master_id || 'custom'} onValueChange={value => {
                            const master = serviceMasters.find(m => m.id === value);
                            setService(c => ({ ...c, master_id: master ? value : '', amount: master ? String(Number(master.default_amount || 0)) : c.amount }));
                        }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {serviceMasters.map(m => <SelectItem key={m.id} value={m.id}>{m.name} — {money(Number(m.default_amount || 0))}</SelectItem>)}
                                <SelectItem value="custom">Other (type below)</SelectItem>
                            </SelectContent>
                        </Select>
                        {!service.master_id && <Input placeholder="Description" value={service.description} onChange={e => setService(c => ({ ...c, description: e.target.value }))} />}
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={1} step={1} value={service.quantity} onChange={e => setService(c => ({ ...c, quantity: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Amount each</Label>
                        <Input type="number" min={0} step="0.01" value={service.amount} onChange={e => setService(c => ({ ...c, amount: e.target.value }))} />
                    </div>
                    <Button type="button" variant="outline" onClick={addService}><Plus className="mr-1 h-4 w-4" />Add</Button>
                </div>
            )}

            {tab === 'buffet' && (
                <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[150px_120px_80px_1fr_auto] sm:items-end">
                        <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input type="date" min={stayFrom} max={stayTo} value={buffet.date} onChange={e => setBuffet(c => ({ ...c, date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Meal</Label>
                            <Select value={buffet.meal_type} onValueChange={value => setBuffet(c => ({ ...c, meal_type: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="breakfast">Breakfast</SelectItem>
                                    <SelectItem value="lunch">Lunch</SelectItem>
                                    <SelectItem value="dinner">Dinner</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Guests</Label>
                            <Input type="number" min={1} step={1} value={buffet.guests} onChange={e => setBuffet(c => ({ ...c, guests: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Package</Label>
                            <Select value={buffet.package_id || 'none'} onValueChange={value => setBuffet(c => ({ ...c, package_id: value === 'none' ? '' : value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No package (booking only)</SelectItem>
                                    {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="button" variant="outline" onClick={addBuffet}><Plus className="mr-1 h-4 w-4" />Add</Button>
                    </div>
                    {selectedPackage && <p className="text-xs text-muted-foreground">Estimated total incl. service charge and VAT: <span className="font-medium text-foreground">{money(buffetEstimate)}</span></p>}
                </div>
            )}

            {(pending.experiences.length + pending.services.length + pending.buffets.length > 0) && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To add when saved</p>
                    <div className="divide-y rounded-md border">
                        {pending.experiences.map((item, index) => (
                            <PendingRow key={`e${index}`} tag="Experience" label={`${item.name} — ${item.people} × ${money(item.rate)}`} amount={item.people * item.rate} note="+ service charge & tax" onRemove={() => removePending('experiences', index)} />
                        ))}
                        {pending.services.map((item, index) => (
                            <PendingRow key={`s${index}`} tag={item.service_type} label={item.description} amount={item.amount} onRemove={() => removePending('services', index)} />
                        ))}
                        {pending.buffets.map((item, index) => (
                            <PendingRow key={`b${index}`} tag="Buffet" label={`${item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1)} · ${item.date} · ${item.guests} guests${item.package_name ? ` · ${item.package_name}` : ''}`} amount={item.estimate || 0} note={item.package_id ? undefined : 'booking only'} onRemove={() => removePending('buffets', index)} />
                        ))}
                    </div>
                    <p className="text-right text-sm text-muted-foreground">Estimated: <span className="font-semibold text-foreground">{money(pendingTotal)}</span></p>
                </div>
            )}

            {bookingId && (isLoadingSaved || saved.length > 0) && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Already on the room bill</p>
                    {isLoadingSaved ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading extras…</p>
                    ) : (
                        <div className="divide-y rounded-md border">
                            {saved.map(extra => (
                                <div key={extra.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">{extra.service_type}</Badge>
                                            <span className="truncate font-medium">{extra.description}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{[serviceInvoiceNumber(extra), extra.date, extra.room_number].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge variant={extra.payment_status === 'paid' ? 'default' : 'secondary'}>{extra.payment_status === 'paid' ? 'Paid' : 'Added to bill'}</Badge>
                                        <span className="whitespace-nowrap font-medium tabular-nums">{money(Number(extra.amount))}</span>
                                        {extra.payment_status === 'add_to_bill' && (
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={removingId === extra.id} onClick={() => removeSaved(extra)} aria-label="Remove from room bill">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function PendingRow({ tag, label, amount, note, onRemove }: { tag: string; label: string; amount: number; note?: string; onRemove: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="outline">{tag}</Badge>
                <span className="truncate">{label}</span>
                {note && <span className="text-xs text-muted-foreground">{note}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="whitespace-nowrap font-medium tabular-nums">{money(amount)}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>
    );
}
