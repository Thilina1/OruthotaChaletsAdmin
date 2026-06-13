'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Trash2, RotateCcw, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { WorkingCalendar } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayType = 'holiday' | 'half_day' | 'working_day';
type OverrideSource = 'common' | 'personal' | 'excluded';

type CalendarEntry = { id: string; calendar_id: string; date: string; title: string; day_type: DayType };
type UserOverride  = { id: string; user_id: string; date: string; title: string; day_type: DayType; action: 'add' | 'remove' };
type Employee      = { id: string; name: string; email: string; job_title?: string; working_calendar_id?: string };

type EffectiveEntry = { title: string; day_type: DayType; source: OverrideSource };

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function isWeekend(y: number, m: number, d: number) {
    const day = new Date(y, m - 1, d).getDay();
    return day === 0 || day === 6;
}
function fmt(date: string) {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
}

function DayTypeBadge({ type }: { type: DayType }) {
    if (type === 'holiday')     return <Badge variant="outline" className="border-red-400 text-red-700 text-xs">Holiday</Badge>;
    if (type === 'half_day')    return <Badge variant="outline" className="border-orange-400 text-orange-700 text-xs">Half Day</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-700 text-xs">Working Day</Badge>;
}

// ─── Employee day cell ────────────────────────────────────────────────────────

function EmployeeDayCell({
    year, month, day, entry, onClick,
}: {
    year: number; month: number; day: number;
    entry: EffectiveEntry | undefined;
    onClick: () => void;
}) {
    const weekend = isWeekend(year, month, day);
    const today   = new Date();
    const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;

    let bg     = 'bg-background hover:bg-muted/60';
    let border = 'border-border';

    if (weekend && !entry) { bg = 'bg-muted/40'; border = 'border-muted'; }

    if (entry) {
        if (entry.source === 'excluded') {
            bg = 'bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100';
            border = 'border-gray-200 dark:border-gray-700';
        } else if (entry.source === 'personal') {
            if (entry.day_type === 'half_day') {
                bg = 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30';
                border = 'border-orange-200 dark:border-orange-900';
            } else {
                bg = 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30';
                border = 'border-indigo-200 dark:border-indigo-900';
            }
        } else { // common
            if (entry.day_type === 'holiday')      { bg = 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30';       border = 'border-red-200 dark:border-red-900'; }
            else if (entry.day_type === 'half_day') { bg = 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30'; border = 'border-orange-200 dark:border-orange-900'; }
            else                                   { bg = 'bg-green-50 hover:bg-green-100 dark:bg-green-950/30'; border = 'border-green-200 dark:border-green-900'; }
        }
    }

    const labelColor =
        !entry ? '' :
        entry.source === 'excluded'  ? 'border-gray-400 text-gray-400 line-through' :
        entry.source === 'personal'  ? (entry.day_type === 'half_day' ? 'border-orange-400 text-orange-700 dark:text-orange-400' : 'border-indigo-400 text-indigo-700 dark:text-indigo-400') :
        entry.day_type === 'holiday' ? 'border-red-400 text-red-700 dark:text-red-400' :
        entry.day_type === 'half_day'? 'border-orange-400 text-orange-700 dark:text-orange-400' :
                                       'border-green-500 text-green-700 dark:text-green-400';

    const labelText =
        !entry ? '' :
        entry.source === 'excluded'  ? 'Excluded' :
        entry.source === 'personal'  ? (entry.day_type === 'half_day' ? 'Half Day ★' : 'Personal ★') :
        entry.day_type === 'half_day'? 'Half Day' :
        entry.day_type === 'working_day' ? 'Working' : 'Holiday';

    return (
        <div
            onClick={onClick}
            className={`relative rounded-lg border ${border} ${bg} p-2 min-h-[80px] cursor-pointer transition-colors select-none`}
        >
            <div className={`text-sm font-semibold mb-1 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                {day}
            </div>
            {weekend && !entry && <span className="text-[10px] text-muted-foreground">Weekend</span>}
            {entry && (
                <div>
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${labelColor}`}>
                        {labelText}
                    </Badge>
                    <p className={`text-[11px] mt-0.5 leading-tight break-words ${entry.source === 'excluded' ? 'text-muted-foreground line-through' : 'text-foreground/80'}`}>
                        {entry.title}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Single-entry form (click-on-day dialog) ──────────────────────────────────

const entrySchema = z.object({
    title:    z.string().min(1, 'Title is required'),
    day_type: z.enum(['holiday', 'half_day', 'working_day']),
});
type EntryFormValues = z.infer<typeof entrySchema>;

function EntryForm({ defaultValues, onSubmit, onCancel }: {
    defaultValues?: Partial<EntryFormValues>;
    onSubmit: (v: EntryFormValues) => Promise<void>;
    onCancel: () => void;
}) {
    const form = useForm<EntryFormValues>({
        resolver: zodResolver(entrySchema),
        defaultValues: { title: '', day_type: 'holiday', ...defaultValues },
    });
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title / Reason</FormLabel>
                        <FormControl><Input placeholder="e.g. Personal Holiday" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="day_type" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="holiday">Full Day Holiday</SelectItem>
                                <SelectItem value="half_day">Half Day</SelectItem>
                                <SelectItem value="working_day">Working Day (weekend override)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </div>
            </form>
        </Form>
    );
}

// ─── Multi-row add form ───────────────────────────────────────────────────────

const rowSchema  = z.object({ date: z.string().min(1,'Required'), title: z.string().min(1,'Required'), day_type: z.enum(['holiday','half_day','working_day']) });
const addSchema  = z.object({ rows: z.array(rowSchema).min(1) });
type AddFormValues = z.infer<typeof addSchema>;

function AddHolidayForm({ onSubmit, onCancel }: { onSubmit: (v: AddFormValues) => Promise<void>; onCancel: () => void }) {
    const form = useForm<AddFormValues>({
        resolver: zodResolver(addSchema),
        defaultValues: { rows: [{ date: '', title: '', day_type: 'holiday' }] },
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-[130px_1fr_120px_32px] gap-2 px-1">
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                    <span className="text-xs font-medium text-muted-foreground">Title / Reason</span>
                    <span className="text-xs font-medium text-muted-foreground">Type</span>
                    <span />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {fields.map((field, i) => (
                        <div key={field.id} className="grid grid-cols-[130px_1fr_120px_32px] gap-2 items-start">
                            <FormField control={form.control} name={`rows.${i}.date`} render={({ field }) => (
                                <FormItem className="space-y-0"><FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl><FormMessage className="text-[10px]" /></FormItem>
                            )} />
                            <FormField control={form.control} name={`rows.${i}.title`} render={({ field }) => (
                                <FormItem className="space-y-0"><FormControl><Input placeholder="e.g. Personal Holiday" className="h-8 text-sm" {...field} /></FormControl><FormMessage className="text-[10px]" /></FormItem>
                            )} />
                            <FormField control={form.control} name={`rows.${i}.day_type`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="holiday">Holiday</SelectItem>
                                            <SelectItem value="half_day">Half Day</SelectItem>
                                            <SelectItem value="working_day">Working Day</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => fields.length > 1 && remove(i)} disabled={fields.length === 1}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full border-dashed"
                    onClick={() => append({ date: '', title: '', day_type: 'holiday' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Row
                </Button>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save {fields.length > 1 ? `${fields.length} Entries` : 'Entry'}</Button>
                </div>
            </form>
        </Form>
    );
}

// ─── Calendar grid view ───────────────────────────────────────────────────────

function EmployeeCalendarGrid({
    year, month, effectiveMap, onDayClick, onPrev, onNext, onToday, calendarYear,
}: {
    year: number; month: number;
    effectiveMap: Record<string, EffectiveEntry>;
    onDayClick: (dateStr: string, entry: EffectiveEntry | undefined) => void;
    onPrev: () => void; onNext: () => void; onToday: () => void;
    calendarYear: number;
}) {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const daysInMonth    = new Date(year, month, 0).getDate();
    const cells: (number | null)[] = [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <Card>
            <CardContent className="pt-4">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-lg font-semibold">{MONTH_NAMES[month - 1]} {year}</p>
                        <p className="text-xs text-muted-foreground">Click any day to add or modify a personal entry.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
                        <Button variant="outline" size="icon" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/60" /> Common Holiday</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 dark:bg-indigo-900/60" /> Personal Holiday ★</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-900/60" /> Half Day</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300" /> Excluded</span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {DAY_NAMES.map(d => (
                        <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
                    ))}
                    {cells.map((day, idx) =>
                        day === null ? (
                            <div key={`e-${idx}`} className="min-h-[80px]" />
                        ) : (
                            <EmployeeDayCell
                                key={day}
                                year={year} month={month} day={day}
                                entry={effectiveMap[toDateStr(year, month, day)]}
                                onClick={() => onDayClick(toDateStr(year, month, day), effectiveMap[toDateStr(year, month, day)])}
                            />
                        )
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface EmployeeCalendarOverridesProps { calendar: WorkingCalendar }

export function EmployeeCalendarOverrides({ calendar }: EmployeeCalendarOverridesProps) {
    const { toast } = useToast();
    const now = new Date();

    const [employees,        setEmployees]        = useState<Employee[]>([]);
    const [selectedId,       setSelectedId]       = useState<string>('');
    const [baseEntries,      setBaseEntries]       = useState<CalendarEntry[]>([]);
    const [overrides,        setOverrides]        = useState<UserOverride[]>([]);
    const [loadingOverrides, setLoadingOverrides] = useState(false);
    const [addOpen,          setAddOpen]          = useState(false);

    // calendar grid state
    const [gridYear,     setGridYear]     = useState(calendar.year);
    const [gridMonth,    setGridMonth]    = useState(now.getMonth() + 1);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedEntry,setSelectedEntry]= useState<EffectiveEntry | undefined>(undefined);

    useEffect(() => {
        fetch('/api/admin/users')
            .then(r => r.json())
            .then(d => setEmployees((d.users ?? []).filter((u: Employee) => u.working_calendar_id === calendar.id)))
            .catch(() => {});
    }, [calendar.id]);

    useEffect(() => {
        fetch(`/api/hrms/working-calendar-entries?calendar_id=${calendar.id}`)
            .then(r => r.json())
            .then(d => setBaseEntries(d.entries ?? []))
            .catch(() => {});
    }, [calendar.id]);

    const fetchOverrides = useCallback(async (userId: string) => {
        setLoadingOverrides(true);
        try {
            const res  = await fetch(`/api/hrms/user-calendar-overrides?userId=${userId}`);
            const data = await res.json();
            setOverrides(data.overrides ?? []);
        } catch { /* silent */ } finally { setLoadingOverrides(false); }
    }, []);

    useEffect(() => {
        if (selectedId) fetchOverrides(selectedId);
        else setOverrides([]);
    }, [selectedId, fetchOverrides]);

    const selectedEmployee = employees.find(e => e.id === selectedId);

    // Compute effective entries
    const effectiveMap = (() => {
        const map: Record<string, EffectiveEntry> = {};
        for (const e of baseEntries) map[e.date] = { title: e.title, day_type: e.day_type, source: 'common' };
        for (const o of overrides) {
            if (o.action === 'add')    map[o.date] = { title: o.title, day_type: o.day_type, source: 'personal' };
            if (o.action === 'remove' && map[o.date]) map[o.date] = { ...map[o.date], source: 'excluded' };
        }
        return map;
    })();

    const removedDates      = new Set(overrides.filter(o => o.action === 'remove').map(o => o.date));
    const personalAdditions = overrides.filter(o => o.action === 'add');
    const baseHolidays      = baseEntries.filter(e => e.day_type !== 'working_day');

    // ── API helpers ────────────────────────────────────────────────────────────

    const upsert = async (date: string, title: string, day_type: string, action: 'add' | 'remove') => {
        const res  = await fetch('/api/hrms/user-calendar-overrides', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: selectedId, date, title, day_type, action }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
    };

    const deleteOverride = async (date: string) => {
        const res  = await fetch(`/api/hrms/user-calendar-overrides?userId=${selectedId}&date=${date}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
    };

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handleAddPersonal = async (values: AddFormValues) => {
        try {
            await Promise.all(values.rows.map(r => upsert(r.date, r.title, r.day_type, 'add')));
            toast({ title: 'Added', description: `${values.rows.length} personal holiday${values.rows.length > 1 ? 's' : ''} added for ${selectedEmployee?.name}.` });
            setAddOpen(false);
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const handleExclude = async (entry: CalendarEntry) => {
        try {
            await upsert(entry.date, entry.title, entry.day_type, 'remove');
            toast({ title: 'Excluded', description: `"${entry.title}" excluded for ${selectedEmployee?.name}.` });
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const handleRestore = async (date: string) => {
        try {
            await deleteOverride(date);
            toast({ title: 'Restored', description: 'Holiday restored.' });
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const handleDeletePersonal = async (date: string, title: string) => {
        try {
            await deleteOverride(date);
            toast({ title: 'Removed', description: `"${title}" removed.` });
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    // day-click in calendar grid
    const handleDayClick = (dateStr: string, entry: EffectiveEntry | undefined) => {
        setSelectedDate(dateStr);
        setSelectedEntry(entry);
    };

    // save from day dialog
    const handleDaySave = async (values: EntryFormValues) => {
        if (!selectedDate) return;
        try {
            await upsert(selectedDate, values.title, values.day_type, 'add');
            toast({ title: 'Saved', description: `Personal entry saved for ${selectedEmployee?.name}.` });
            setSelectedDate(null);
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const handleDayExclude = async () => {
        if (!selectedDate || !selectedEntry) return;
        try {
            await upsert(selectedDate, selectedEntry.title, selectedEntry.day_type, 'remove');
            toast({ title: 'Excluded', description: `"${selectedEntry.title}" excluded for ${selectedEmployee?.name}.` });
            setSelectedDate(null);
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const handleDayRestore = async () => {
        if (!selectedDate) return;
        try {
            await deleteOverride(selectedDate);
            toast({ title: 'Restored', description: 'Holiday restored.' });
            setSelectedDate(null);
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const handleDayRemovePersonal = async () => {
        if (!selectedDate || !selectedEntry) return;
        try {
            await deleteOverride(selectedDate);
            toast({ title: 'Removed', description: `Personal holiday removed.` });
            setSelectedDate(null);
            fetchOverrides(selectedId);
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: (e as Error).message }); }
    };

    const prevMonth = () => { if (gridMonth === 1) { setGridYear(y => y - 1); setGridMonth(12); } else setGridMonth(m => m - 1); };
    const nextMonth = () => { if (gridMonth === 12) { setGridYear(y => y + 1); setGridMonth(1); } else setGridMonth(m => m + 1); };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            {/* Employee selector */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-base">Employee Overrides</CardTitle>
                            <CardDescription className="mt-0.5">
                                Manage holidays for individual employees without affecting the shared calendar.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {employees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No employees assigned to this calendar yet. Assign via <strong>Employee Management → Edit</strong>.
                        </p>
                    ) : (
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="max-w-sm">
                                <SelectValue placeholder="Select an employee…" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(e => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.name}{e.job_title ? ` — ${e.job_title}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

            {selectedEmployee && (
                <Tabs defaultValue="calendar">
                    <div className="flex items-center justify-between mb-2">
                        <TabsList>
                            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                            <TabsTrigger value="personal">
                                Personal Holidays
                                {personalAdditions.length > 0 && (
                                    <Badge className="ml-2 h-4 text-[10px] px-1.5">{personalAdditions.length}</Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="common">
                                Common Calendar
                                {removedDates.size > 0 && (
                                    <Badge variant="destructive" className="ml-2 h-4 text-[10px] px-1.5">{removedDates.size} excl.</Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                        <Button size="sm" onClick={() => setAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Holiday
                        </Button>
                    </div>

                    {/* ── Calendar grid tab ── */}
                    <TabsContent value="calendar" className="mt-0">
                        <EmployeeCalendarGrid
                            year={gridYear} month={gridMonth}
                            effectiveMap={effectiveMap}
                            onDayClick={handleDayClick}
                            onPrev={prevMonth} onNext={nextMonth}
                            onToday={() => { setGridYear(calendar.year); setGridMonth(now.getMonth() + 1); }}
                            calendarYear={calendar.year}
                        />
                    </TabsContent>

                    {/* ── Personal holidays list tab ── */}
                    <TabsContent value="personal">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Personal Holidays — {selectedEmployee.name}</CardTitle>
                                <CardDescription className="text-xs">Extra holidays added only for this employee.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingOverrides ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
                                ) : personalAdditions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        No personal holidays yet. Click <strong>Add Holiday</strong> to add one.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="w-10" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {personalAdditions.map(o => (
                                                <TableRow key={o.date}>
                                                    <TableCell className="text-sm font-mono text-muted-foreground">{fmt(o.date)}</TableCell>
                                                    <TableCell className="text-sm font-medium">{o.title}</TableCell>
                                                    <TableCell><DayTypeBadge type={o.day_type} /></TableCell>
                                                    <TableCell>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeletePersonal(o.date, o.title)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Common holidays tab ── */}
                    <TabsContent value="common">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Common Calendar Holidays</CardTitle>
                                <CardDescription className="text-xs">
                                    Holidays from <strong>{calendar.name}</strong> shared by all employees.
                                    Use <strong>Exclude</strong> to remove a day just for {selectedEmployee.name}.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {baseHolidays.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No holidays in the common calendar.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="w-28" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {baseHolidays.map(e => {
                                                const excluded = removedDates.has(e.date);
                                                return (
                                                    <TableRow key={e.date} className={excluded ? 'opacity-50' : ''}>
                                                        <TableCell className="text-sm font-mono text-muted-foreground">{fmt(e.date)}</TableCell>
                                                        <TableCell className={`text-sm font-medium ${excluded ? 'line-through text-muted-foreground' : ''}`}>{e.title}</TableCell>
                                                        <TableCell><DayTypeBadge type={e.day_type} /></TableCell>
                                                        <TableCell>
                                                            {excluded
                                                                ? <Badge variant="outline" className="text-xs text-gray-500 border-gray-400">Excluded</Badge>
                                                                : <Badge variant="outline" className="text-xs text-green-700 border-green-500">Applied</Badge>}
                                                        </TableCell>
                                                        <TableCell>
                                                            {excluded ? (
                                                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRestore(e.date)}>
                                                                    <RotateCcw className="h-3 w-3" /> Restore
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive gap-1" onClick={() => handleExclude(e)}>
                                                                    <X className="h-3 w-3" /> Exclude
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {/* ── Add personal holiday (multi-row) dialog ── */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Personal Holiday — {selectedEmployee?.name}</DialogTitle>
                    </DialogHeader>
                    <AddHolidayForm onSubmit={handleAddPersonal} onCancel={() => setAddOpen(false)} />
                </DialogContent>
            </Dialog>

            {/* ── Day-click dialog ── */}
            <Dialog open={!!selectedDate} onOpenChange={open => { if (!open) setSelectedDate(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                            {selectedEmployee && <span className="font-normal text-muted-foreground text-sm ml-2">— {selectedEmployee.name}</span>}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedEntry?.source === 'excluded' ? (
                        // Common holiday that's excluded — offer restore or leave as is
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                This common holiday (<strong>{selectedEntry.title}</strong>) is currently <strong>excluded</strong> for {selectedEmployee?.name}.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleDayRestore}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Restore Holiday
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedDate(null)}>Cancel</Button>
                            </div>
                        </div>
                    ) : selectedEntry?.source === 'personal' ? (
                        // Personal addition — offer edit or remove
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground mb-2">
                                Personal holiday: <strong>{selectedEntry.title}</strong>
                            </p>
                            <EntryForm
                                defaultValues={{ title: selectedEntry.title, day_type: selectedEntry.day_type }}
                                onSubmit={handleDaySave}
                                onCancel={() => setSelectedDate(null)}
                            />
                            <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={handleDayRemovePersonal}>
                                <Trash2 className="mr-2 h-4 w-4" /> Remove Personal Holiday
                            </Button>
                        </div>
                    ) : selectedEntry?.source === 'common' ? (
                        // Common holiday — offer exclude or add personal on top
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                This is a common holiday: <strong>{selectedEntry.title}</strong>.
                                You can exclude it just for {selectedEmployee?.name}, or add a personal entry on this date.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={handleDayExclude}>
                                    <X className="mr-2 h-4 w-4" /> Exclude for {selectedEmployee?.name}
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedDate(null)}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        // Normal day — add personal holiday
                        <EntryForm
                            defaultValues={{ day_type: selectedDate && isWeekend(gridYear, gridMonth, parseInt(selectedDate.split('-')[2])) ? 'working_day' : 'holiday' }}
                            onSubmit={handleDaySave}
                            onCancel={() => setSelectedDate(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
