'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, X, Plus, CalendarDays, Pencil, Trash2, ArrowLeft, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeCalendarOverrides } from '@/components/dashboard/hrms/employee-calendar-overrides';
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

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkingCalendar = {
    id: string;
    name: string;
    description?: string;
    year: number;
    is_active: boolean;
    created_at?: string;
};

type DayType = 'holiday' | 'half_day' | 'working_day';

type CalendarEntry = {
    id: string;
    calendar_id: string;
    date: string;
    title: string;
    day_type: DayType;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Schemas ──────────────────────────────────────────────────────────────────

const calendarSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    year: z.string().min(4, 'Year is required'),
});
type CalendarFormValues = z.infer<typeof calendarSchema>;

const entrySchema = z.object({
    title: z.string().min(1, 'Title is required'),
    day_type: z.enum(['holiday', 'half_day', 'working_day']),
});
type EntryFormValues = z.infer<typeof entrySchema>;

// ─── Calendar Form (create/edit) ──────────────────────────────────────────────

function CalendarForm({
    defaultValues,
    onSubmit,
    onCancel,
}: {
    defaultValues?: Partial<CalendarFormValues>;
    onSubmit: (v: CalendarFormValues) => Promise<void>;
    onCancel: () => void;
}) {
    const form = useForm<CalendarFormValues>({
        resolver: zodResolver(calendarSchema),
        defaultValues: { name: '', description: '', year: String(new Date().getFullYear()), ...defaultValues },
    });
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Calendar Name</FormLabel>
                        <FormControl><Input placeholder="e.g. 2025 Annual Calendar" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="year" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl><Input type="number" placeholder="2025" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                        <FormControl><Textarea placeholder="Notes about this calendar..." rows={2} {...field} /></FormControl>
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

// ─── Entry Form (add/edit a day) ──────────────────────────────────────────────

function EntryForm({
    defaultValues,
    defaultDayType = 'holiday',
    onSubmit,
    onCancel,
}: {
    defaultValues?: Partial<EntryFormValues>;
    defaultDayType?: DayType;
    onSubmit: (v: EntryFormValues) => Promise<void>;
    onCancel: () => void;
}) {
    const form = useForm<EntryFormValues>({
        resolver: zodResolver(entrySchema),
        defaultValues: { title: '', day_type: defaultDayType, ...defaultValues },
    });
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title / Reason</FormLabel>
                        <FormControl><Input placeholder="e.g. Independence Day" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="day_type" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="working_day">Working Day (weekend override)</SelectItem>
                                <SelectItem value="holiday">Full Day Holiday</SelectItem>
                                <SelectItem value="half_day">Half Day</SelectItem>
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

// ─── Add Holiday Form (multiple rows) ────────────────────────────────────────

const addHolidayRowSchema = z.object({
    date: z.string().min(1, 'Required'),
    title: z.string().min(1, 'Required'),
    day_type: z.enum(['holiday', 'half_day', 'working_day']),
});
const addHolidaySchema = z.object({
    rows: z.array(addHolidayRowSchema).min(1),
});
type AddHolidayValues = z.infer<typeof addHolidaySchema>;

function AddHolidayForm({
    defaultDate,
    onSubmit,
    onCancel,
}: {
    defaultDate?: string;
    onSubmit: (v: AddHolidayValues) => Promise<void>;
    onCancel: () => void;
}) {
    const form = useForm<AddHolidayValues>({
        resolver: zodResolver(addHolidaySchema),
        defaultValues: { rows: [{ date: defaultDate ?? '', title: '', day_type: 'holiday' }] },
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {/* Column headers */}
                <div className="grid grid-cols-[130px_1fr_120px_32px] gap-2 px-1">
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                    <span className="text-xs font-medium text-muted-foreground">Title / Reason</span>
                    <span className="text-xs font-medium text-muted-foreground">Type</span>
                    <span />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {fields.map((field, i) => (
                        <div key={field.id} className="grid grid-cols-[130px_1fr_120px_32px] gap-2 items-start">
                            <FormField control={form.control} name={`rows.${i}.date`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`rows.${i}.title`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <FormControl><Input placeholder="e.g. Independence Day" className="h-8 text-sm" {...field} /></FormControl>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`rows.${i}.day_type`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="holiday">Holiday</SelectItem>
                                            <SelectItem value="half_day">Half Day</SelectItem>
                                            <SelectItem value="working_day">Working Day</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <Button
                                type="button" variant="ghost" size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => fields.length > 1 && remove(i)}
                                disabled={fields.length === 1}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                <Button
                    type="button" variant="outline" size="sm" className="w-full border-dashed"
                    onClick={() => append({ date: '', title: '', day_type: 'holiday' })}
                >
                    <Plus className="h-4 w-4 mr-2" /> Add Row
                </Button>

                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">
                        Save {fields.length > 1 ? `${fields.length} Entries` : 'Entry'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function toDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isWeekend(year: number, month: number, day: number) {
    const d = new Date(year, month - 1, day).getDay();
    return d === 0 || d === 6;
}

type DayCellProps = {
    year: number;
    month: number;
    day: number;
    entry: CalendarEntry | undefined;
    onClick: () => void;
    onRemove: (e: React.MouseEvent) => void;
};

function DayCell({ year, month, day, entry, onClick, onRemove }: DayCellProps) {
    const weekend = isWeekend(year, month, day);
    const today = new Date();
    const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;

    let bg = 'bg-background hover:bg-muted/60';
    let border = 'border-border';
    if (weekend) { bg = 'bg-muted/40'; border = 'border-muted'; }
    if (entry?.day_type === 'holiday') { bg = 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30'; border = 'border-red-200 dark:border-red-900'; }
    if (entry?.day_type === 'half_day') { bg = 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30'; border = 'border-orange-200 dark:border-orange-900'; }
    if (entry?.day_type === 'working_day') { bg = 'bg-green-50 hover:bg-green-100 dark:bg-green-950/30'; border = 'border-green-200 dark:border-green-900'; }

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
                <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 truncate max-w-full ${
                            entry.day_type === 'holiday'
                                ? 'border-red-400 text-red-700 dark:text-red-400'
                                : entry.day_type === 'half_day'
                                ? 'border-orange-400 text-orange-700 dark:text-orange-400'
                                : 'border-green-500 text-green-700 dark:text-green-400'
                        }`}>
                            {entry.day_type === 'half_day' ? 'Half Day' : entry.day_type === 'working_day' ? 'Working' : 'Holiday'}
                        </Badge>
                        <p className="text-[11px] text-foreground/80 mt-0.5 leading-tight break-words">{entry.title}</p>
                    </div>
                    <button onClick={onRemove} className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5" aria-label="Remove">
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── List View ────────────────────────────────────────────────────────────────

function CalendarListView({
    calendars,
    loading,
    onSelect,
    onCreate,
    onEdit,
    onDelete,
}: {
    calendars: WorkingCalendar[];
    loading: boolean;
    onSelect: (c: WorkingCalendar) => void;
    onCreate: () => void;
    onEdit: (c: WorkingCalendar) => void;
    onDelete: (c: WorkingCalendar) => void;
}) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Working Calendars</h1>
                    <p className="text-muted-foreground">Create and manage holiday calendars for each year.</p>
                </div>
                <Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" /> New Calendar</Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="rounded-xl border bg-muted/20 h-40 animate-pulse" />)}
                </div>
            ) : calendars.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
                        <CalendarDays className="h-10 w-10" />
                        <p className="text-sm">No working calendars yet. Create one to get started.</p>
                        <Button variant="outline" onClick={onCreate}><Plus className="mr-2 h-4 w-4" /> New Calendar</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {calendars.map(cal => (
                        <Card key={cal.id} className="flex flex-col hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <CardTitle className="text-base truncate">{cal.name}</CardTitle>
                                        {cal.description && (
                                            <CardDescription className="mt-1 text-xs line-clamp-2">{cal.description}</CardDescription>
                                        )}
                                    </div>
                                    <Badge variant={cal.is_active ? 'default' : 'secondary'} className="shrink-0 text-xs">
                                        {cal.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-end pt-0">
                                <div className="flex items-center gap-1.5 mb-4">
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-semibold">{cal.year}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" className="flex-1" onClick={() => onSelect(cal)}>
                                        View Calendar
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => onEdit(cal)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onDelete(cal)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Calendar Detail View ─────────────────────────────────────────────────────

function CalendarDetailView({
    calendar,
    onBack,
}: {
    calendar: WorkingCalendar;
    onBack: () => void;
}) {
    const now = new Date();
    const [year, setYear] = useState(calendar.year);
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [removingDate, setRemovingDate] = useState<string | null>(null);

    // Add holiday manually
    const [addHolidayOpen, setAddHolidayOpen] = useState(false);

    // Import holidays state
    type ImportHoliday = { date: string; title: string; day_type: 'holiday'; selected: boolean };
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [importHolidays, setImportHolidays] = useState<ImportHoliday[]>([]);
    const [importing, setImporting] = useState(false);

    const { toast } = useToast();

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/hrms/working-calendar-entries?calendar_id=${calendar.id}&year=${year}&month=${month}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setEntries(data.entries ?? []);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [calendar.id, year, month, toast]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const handleAddHoliday = async (values: AddHolidayValues) => {
        try {
            await Promise.all(
                values.rows.map(row =>
                    fetch('/api/hrms/working-calendar-entries', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ calendar_id: calendar.id, ...row }),
                    })
                )
            );
            toast({ title: 'Added', description: `${values.rows.length} entr${values.rows.length > 1 ? 'ies' : 'y'} added.` });
            setAddHolidayOpen(false);
            fetchEntries();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const openImportDialog = async () => {
        setImportDialogOpen(true);
        setImportLoading(true);
        try {
            const res = await fetch(`/api/hrms/import-holidays?year=${year}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setImportHolidays(
                (data.holidays ?? []).map((h: { date: string; title: string; day_type: 'holiday' }) => ({ ...h, selected: true }))
            );
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
            setImportDialogOpen(false);
        } finally {
            setImportLoading(false);
        }
    };

    const handleImport = async () => {
        const selected = importHolidays.filter(h => h.selected);
        if (selected.length === 0) return;
        setImporting(true);
        try {
            await Promise.all(
                selected.map(h =>
                    fetch('/api/hrms/working-calendar-entries', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ calendar_id: calendar.id, date: h.date, title: h.title, day_type: h.day_type }),
                    })
                )
            );
            toast({ title: 'Imported', description: `${selected.length} holiday${selected.length > 1 ? 's' : ''} added to calendar.` });
            setImportDialogOpen(false);
            fetchEntries();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setImporting(false);
        }
    };

    const entryMap = Object.fromEntries(entries.map(e => [e.date, e]));
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    };

    const selectedEntry = selectedDay ? entryMap[toDateStr(year, month, selectedDay)] : undefined;

    const handleSave = async (values: EntryFormValues) => {
        if (!selectedDay) return;
        try {
            const res = await fetch('/api/hrms/working-calendar-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calendar_id: calendar.id, date: toDateStr(year, month, selectedDay), ...values }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Saved', description: 'Calendar entry saved.' });
            setSelectedDay(null);
            fetchEntries();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleRemove = async () => {
        if (!removingDate) return;
        try {
            const res = await fetch(`/api/hrms/working-calendar-entries?calendar_id=${calendar.id}&date=${removingDate}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Removed', description: 'Entry removed.' });
            setRemovingDate(null);
            fetchEntries();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const holidayCount = entries.filter(e => e.day_type === 'holiday').length;
    const halfDayCount = entries.filter(e => e.day_type === 'half_day').length;
    const workingWeekendCount = entries.filter(e => e.day_type === 'working_day').length;
    const weekendCount = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => isWeekend(year, month, d)).length;
    const workingDays = daysInMonth - weekendCount + workingWeekendCount - holidayCount - halfDayCount;

    const cells: (number | null)[] = [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div className="space-y-6">
            {/* Breadcrumb + back */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Working Calendars
                </button>
                <span>/</span>
                <span className="text-foreground font-medium">{calendar.name}</span>
            </div>

            <Tabs defaultValue="calendar">
            <TabsList>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="employee-overrides">Employee Overrides</TabsTrigger>
            </TabsList>

            <TabsContent value="employee-overrides" className="mt-4">
                <EmployeeCalendarOverrides calendar={calendar} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-4 space-y-6">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline font-bold">{calendar.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{calendar.year}</Badge>
                        <Badge variant={calendar.is_active ? 'default' : 'secondary'}>{calendar.is_active ? 'Active' : 'Inactive'}</Badge>
                        {calendar.description && <span className="text-sm text-muted-foreground">{calendar.description}</span>}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAddHolidayOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Holiday
                    </Button>
                    <Button variant="outline" size="sm" onClick={openImportDialog}>
                        <Download className="h-4 w-4 mr-2" /> Import LK Holidays {year}
                    </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap justify-end">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/60 inline-block" /> Holidays: <strong className="text-foreground">{holidayCount}</strong></span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-900/60 inline-block" /> Half Days: <strong className="text-foreground">{halfDayCount}</strong></span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted inline-block" /> Weekends: <strong className="text-foreground">{weekendCount - workingWeekendCount}</strong></span>
                    {workingWeekendCount > 0 && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-300 dark:bg-green-700 inline-block" /> Working Wknds: <strong className="text-foreground">{workingWeekendCount}</strong></span>}
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 dark:bg-green-900/60 inline-block" /> Working: <strong className="text-foreground">{workingDays}</strong></span>
                </div>
                </div> {/* end flex-col items-end */}
            </div>

            {/* Calendar Grid */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">{MONTH_NAMES[month - 1]} {year}</CardTitle>
                            <CardDescription>Click any day to add or update a holiday / half day.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => { setYear(calendar.year); setMonth(now.getMonth() + 1); }}>
                                Today
                            </Button>
                            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="grid grid-cols-7 gap-2">
                            {DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}
                            {Array(35).fill(null).map((_, i) => <div key={i} className="rounded-lg border bg-muted/20 min-h-[80px] animate-pulse" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>)}
                            {cells.map((day, idx) => (
                                day === null ? (
                                    <div key={`empty-${idx}`} className="min-h-[80px]" />
                                ) : (
                                    <DayCell
                                        key={day}
                                        year={year}
                                        month={month}
                                        day={day}
                                        entry={entryMap[toDateStr(year, month, day)]}
                                        onClick={() => setSelectedDay(day)}
                                        onRemove={(e) => { e.stopPropagation(); setRemovingDate(toDateStr(year, month, day)); }}
                                    />
                                )
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Entries List */}
            {entries.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Special Days in {MONTH_NAMES[month - 1]}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {entries.map(e => (
                                <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-mono text-muted-foreground w-20">
                                            {new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        </span>
                                        <span className="text-sm font-medium">{e.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={
                                            e.day_type === 'holiday' ? 'border-red-400 text-red-700 dark:text-red-400'
                                            : e.day_type === 'half_day' ? 'border-orange-400 text-orange-700 dark:text-orange-400'
                                            : 'border-green-500 text-green-700 dark:text-green-400'
                                        }>
                                            {e.day_type === 'half_day' ? 'Half Day' : e.day_type === 'working_day' ? 'Working Day' : 'Holiday'}
                                        </Badge>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => setRemovingDate(e.date)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            </TabsContent>{/* end calendar TabsContent */}
            </Tabs>

            {/* Add Holiday Manually */}
            <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Add Holidays</DialogTitle></DialogHeader>
                    <AddHolidayForm
                        defaultDate={toDateStr(year, month, 1)}
                        onSubmit={handleAddHoliday}
                        onCancel={() => setAddHolidayOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Add/Edit Day Dialog */}
            <Dialog open={selectedDay !== null} onOpenChange={open => { if (!open) setSelectedDay(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedEntry ? 'Edit Entry' : 'Add Entry'} —{' '}
                            {selectedDay && new Date(year, month - 1, selectedDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDay !== null && (
                        <EntryForm
                            defaultValues={selectedEntry ? { title: selectedEntry.title, day_type: selectedEntry.day_type } : undefined}
                            defaultDayType={!selectedEntry ? (isWeekend(year, month, selectedDay) ? 'working_day' : 'holiday') : undefined}
                            onSubmit={handleSave}
                            onCancel={() => setSelectedDay(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Remove Entry Confirmation */}
            <AlertDialog open={!!removingDate} onOpenChange={open => { if (!open) setRemovingDate(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {removingDate && new Date(removingDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} will be treated as a normal working day.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Import LK Holidays Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={open => { if (!open) setImportDialogOpen(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Import Sri Lanka Public Holidays — {year}</DialogTitle>
                    </DialogHeader>

                    {importLoading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">Fetching holidays from Calendarific…</div>
                    ) : importHolidays.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No holidays found for {year}.</div>
                    ) : (
                        <>
                            <p className="text-xs text-muted-foreground mb-3">
                                {importHolidays.filter(h => h.selected).length} of {importHolidays.length} selected. Existing entries for the same date will be overwritten.
                            </p>
                            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                                {importHolidays.map((h, i) => (
                                    <label key={h.date} className="flex items-center gap-3 py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/40 px-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={h.selected}
                                            onChange={e => setImportHolidays(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                                            className="accent-primary h-4 w-4 shrink-0"
                                        />
                                        <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">
                                            {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </span>
                                        <span className="text-sm">{h.title}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setImportHolidays(prev => prev.map(h => ({ ...h, selected: !prev.every(x => x.selected) })))}
                                >
                                    {importHolidays.every(h => h.selected) ? 'Deselect All' : 'Select All'}
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                                    <Button
                                        size="sm"
                                        disabled={importing || importHolidays.filter(h => h.selected).length === 0}
                                        onClick={handleImport}
                                    >
                                        {importing ? 'Importing…' : `Import ${importHolidays.filter(h => h.selected).length} Holidays`}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkingCalendarPage() {
    const [view, setView] = useState<'list' | 'calendar'>('list');
    const [calendars, setCalendars] = useState<WorkingCalendar[]>([]);
    const [selectedCalendar, setSelectedCalendar] = useState<WorkingCalendar | null>(null);
    const [loading, setLoading] = useState(true);

    // Calendar create/edit dialog
    const [calDialogOpen, setCalDialogOpen] = useState(false);
    const [editingCal, setEditingCal] = useState<WorkingCalendar | null>(null);

    // Delete confirmation
    const [deletingCal, setDeletingCal] = useState<WorkingCalendar | null>(null);

    const { toast } = useToast();

    const fetchCalendars = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/working-calendars');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setCalendars(data.calendars ?? []);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchCalendars(); }, [fetchCalendars]);

    const handleCreateOrEdit = async (values: CalendarFormValues) => {
        try {
            const body = { ...values, year: Number(values.year) };
            const res = await fetch('/api/hrms/working-calendars', {
                method: editingCal ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingCal ? { id: editingCal.id, ...body, is_active: editingCal.is_active } : body),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: editingCal ? 'Updated' : 'Created', description: `Calendar ${editingCal ? 'updated' : 'created'} successfully.` });
            setCalDialogOpen(false);
            setEditingCal(null);
            fetchCalendars();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleDelete = async () => {
        if (!deletingCal) return;
        try {
            const res = await fetch(`/api/hrms/working-calendars?id=${deletingCal.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Deleted', description: 'Calendar deleted.' });
            setDeletingCal(null);
            fetchCalendars();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const openCreate = () => { setEditingCal(null); setCalDialogOpen(true); };
    const openEdit = (cal: WorkingCalendar) => { setEditingCal(cal); setCalDialogOpen(true); };
    const openCalendar = (cal: WorkingCalendar) => { setSelectedCalendar(cal); setView('calendar'); };

    if (view === 'calendar' && selectedCalendar) {
        return (
            <>
                <CalendarDetailView
                    calendar={selectedCalendar}
                    onBack={() => { setSelectedCalendar(null); setView('list'); }}
                />
            </>
        );
    }

    return (
        <>
            <CalendarListView
                calendars={calendars}
                loading={loading}
                onSelect={openCalendar}
                onCreate={openCreate}
                onEdit={openEdit}
                onDelete={(cal) => setDeletingCal(cal)}
            />

            {/* Create/Edit Calendar Dialog */}
            <Dialog open={calDialogOpen} onOpenChange={open => { setCalDialogOpen(open); if (!open) setEditingCal(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCal ? 'Edit Calendar' : 'New Working Calendar'}</DialogTitle>
                    </DialogHeader>
                    <CalendarForm
                        defaultValues={editingCal ? { name: editingCal.name, description: editingCal.description ?? '', year: String(editingCal.year) } : undefined}
                        onSubmit={handleCreateOrEdit}
                        onCancel={() => { setCalDialogOpen(false); setEditingCal(null); }}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Calendar Confirmation */}
            <AlertDialog open={!!deletingCal} onOpenChange={open => { if (!open) setDeletingCal(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{deletingCal?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the calendar and all its holiday/half-day entries. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
