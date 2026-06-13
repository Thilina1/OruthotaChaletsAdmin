'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog as SubDialog,
    DialogContent as SubDialogContent,
    DialogHeader as SubDialogHeader,
    DialogTitle as SubDialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Trash2, RotateCcw, CalendarDays } from 'lucide-react';
import type { User, WorkingCalendar } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayType = 'holiday' | 'half_day' | 'working_day';

type CalendarEntry = {
    id: string;
    calendar_id: string;
    date: string;
    title: string;
    day_type: DayType;
};

type UserOverride = {
    id: string;
    user_id: string;
    date: string;
    title: string;
    day_type: DayType;
    action: 'add' | 'remove';
};

// ─── Add holiday form ─────────────────────────────────────────────────────────

const rowSchema = z.object({
    date: z.string().min(1, 'Required'),
    title: z.string().min(1, 'Required'),
    day_type: z.enum(['holiday', 'half_day', 'working_day']),
});
const addSchema = z.object({ rows: z.array(rowSchema).min(1) });
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
                                <FormItem className="space-y-0">
                                    <FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`rows.${i}.title`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <FormControl><Input placeholder="e.g. Personal Holiday" className="h-8 text-sm" {...field} /></FormControl>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string) {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
}

function DayTypeBadge({ type }: { type: DayType }) {
    if (type === 'holiday') return <Badge variant="outline" className="border-red-400 text-red-700 text-xs">Holiday</Badge>;
    if (type === 'half_day') return <Badge variant="outline" className="border-orange-400 text-orange-700 text-xs">Half Day</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-700 text-xs">Working Day</Badge>;
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface EmployeeCalendarDialogProps {
    employee: User;
    isOpen: boolean;
    onClose: () => void;
}

export function EmployeeCalendarDialog({ employee, isOpen, onClose }: EmployeeCalendarDialogProps) {
    const { toast } = useToast();
    const [calendar, setCalendar] = useState<WorkingCalendar | null>(null);
    const [baseEntries, setBaseEntries] = useState<CalendarEntry[]>([]);
    const [overrides, setOverrides] = useState<UserOverride[]>([]);
    const [loading, setLoading] = useState(false);
    const [addOpen, setAddOpen] = useState(false);

    // Fetch the assigned calendar info
    useEffect(() => {
        if (!isOpen || !employee.working_calendar_id) { setCalendar(null); return; }
        fetch('/api/hrms/working-calendars')
            .then(r => r.json())
            .then(d => {
                const found = (d.calendars ?? []).find((c: WorkingCalendar) => c.id === employee.working_calendar_id);
                setCalendar(found ?? null);
            })
            .catch(() => {});
    }, [isOpen, employee.working_calendar_id]);

    // Fetch base calendar entries when calendar is known
    useEffect(() => {
        if (!calendar) { setBaseEntries([]); return; }
        fetch(`/api/hrms/working-calendar-entries?calendar_id=${calendar.id}`)
            .then(r => r.json())
            .then(d => setBaseEntries(d.entries ?? []))
            .catch(() => {});
    }, [calendar]);

    const fetchOverrides = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/hrms/user-calendar-overrides?userId=${employee.id}`);
            const data = await res.json();
            setOverrides(data.overrides ?? []);
        } catch {
            // fail silently
        } finally {
            setLoading(false);
        }
    }, [employee.id]);

    useEffect(() => { if (isOpen) fetchOverrides(); }, [isOpen, fetchOverrides]);

    const upsert = async (date: string, title: string, day_type: string, action: 'add' | 'remove') => {
        const res = await fetch('/api/hrms/user-calendar-overrides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: employee.id, date, title, day_type, action }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
    };

    const deleteOverride = async (date: string) => {
        const res = await fetch(`/api/hrms/user-calendar-overrides?userId=${employee.id}&date=${date}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
    };

    const handleAddPersonal = async (values: AddFormValues) => {
        try {
            await Promise.all(values.rows.map(r => upsert(r.date, r.title, r.day_type, 'add')));
            toast({ title: 'Added', description: `${values.rows.length} personal holiday${values.rows.length > 1 ? 's' : ''} added.` });
            setAddOpen(false);
            fetchOverrides();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleExclude = async (entry: CalendarEntry) => {
        try {
            await upsert(entry.date, entry.title, entry.day_type, 'remove');
            toast({ title: 'Excluded', description: `"${entry.title}" excluded for ${employee.name}.` });
            fetchOverrides();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleRestore = async (date: string) => {
        try {
            await deleteOverride(date);
            toast({ title: 'Restored', description: 'Holiday restored.' });
            fetchOverrides();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleDeletePersonal = async (date: string, title: string) => {
        try {
            await deleteOverride(date);
            toast({ title: 'Removed', description: `"${title}" removed.` });
            fetchOverrides();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const removedDates = new Set(overrides.filter(o => o.action === 'remove').map(o => o.date));
    const personalAdditions = overrides.filter(o => o.action === 'add');
    const baseHolidays = baseEntries.filter(e => e.day_type !== 'working_day');

    return (
        <>
            <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{employee.name} — Calendar Holidays</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {calendar
                                ? <>Assigned calendar: <strong>{calendar.name}</strong> ({calendar.year})</>
                                : 'No working calendar assigned. Assign one via Edit Employee.'}
                        </p>
                    </DialogHeader>

                    {!employee.working_calendar_id ? (
                        <Card className="border-dashed">
                            <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
                                <CalendarDays className="h-5 w-5 flex-shrink-0" />
                                No working calendar assigned to this employee.
                            </CardContent>
                        </Card>
                    ) : (
                        <Tabs defaultValue="personal">
                            <TabsList className="w-full">
                                <TabsTrigger value="personal" className="flex-1">
                                    Personal Holidays
                                    {personalAdditions.length > 0 && (
                                        <Badge className="ml-2 h-4 text-[10px] px-1.5">{personalAdditions.length}</Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="common" className="flex-1">
                                    Common Calendar
                                    {removedDates.size > 0 && (
                                        <Badge variant="destructive" className="ml-2 h-4 text-[10px] px-1.5">{removedDates.size} excluded</Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            {/* ── Personal holidays tab ── */}
                            <TabsContent value="personal" className="mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Extra holidays added only for {employee.name}. They don't affect anyone else.
                                    </p>
                                    <Button size="sm" onClick={() => setAddOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Holiday
                                    </Button>
                                </div>

                                {loading ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
                                ) : personalAdditions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No personal holidays added yet.</p>
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
                            </TabsContent>

                            {/* ── Common calendar tab ── */}
                            <TabsContent value="common" className="mt-4 space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    These holidays apply to everyone on the <strong>{calendar?.name}</strong> calendar.
                                    Use <strong>Exclude</strong> to remove a day just for {employee.name}. Other employees are not affected.
                                </p>

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
                                                <TableHead className="w-24" />
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
                                                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                                                    onClick={() => handleRestore(e.date)}>
                                                                    <RotateCcw className="h-3 w-3" /> Restore
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                                                                    onClick={() => handleExclude(e)}>
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
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add personal holiday sub-dialog */}
            <SubDialog open={addOpen} onOpenChange={setAddOpen}>
                <SubDialogContent className="max-w-2xl">
                    <SubDialogHeader>
                        <SubDialogTitle>Add Personal Holiday — {employee.name}</SubDialogTitle>
                    </SubDialogHeader>
                    <AddHolidayForm onSubmit={handleAddPersonal} onCancel={() => setAddOpen(false)} />
                </SubDialogContent>
            </SubDialog>
        </>
    );
}
