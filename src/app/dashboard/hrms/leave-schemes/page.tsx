'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Layers, ChevronDown, ChevronRight } from 'lucide-react';
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
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { LeaveScheme, LeaveSchemeType } from '@/lib/types';

// ─── Scheme form ────────────────────────────────────────────────────────────

const schemeSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
});
type SchemeFormValues = z.infer<typeof schemeSchema>;

function SchemeForm({
    defaultValues,
    onSubmit,
    onCancel,
}: {
    defaultValues?: Partial<SchemeFormValues>;
    onSubmit: (v: SchemeFormValues) => Promise<void>;
    onCancel: () => void;
}) {
    const form = useForm<SchemeFormValues>({
        resolver: zodResolver(schemeSchema),
        defaultValues: { name: '', description: '', ...defaultValues },
    });
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Scheme Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Standard Leave Policy" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea placeholder="Optional notes..." {...field} /></FormControl>
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

// ─── Leave type form ─────────────────────────────────────────────────────────

const leaveTypeSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    days_count: z.coerce.number().min(0),
    reset_period: z.enum(['weekly', 'monthly', 'yearly']),
    carry_forward: z.boolean(),
    // kept as string to avoid null/undefined → value={null} on <input>; converted in submit handlers
    carry_forward_max: z.string().optional(),
});
type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>;

function LeaveTypeForm({
    defaultValues,
    onSubmit,
    onCancel,
}: {
    defaultValues?: Partial<LeaveTypeFormValues>;
    onSubmit: (v: LeaveTypeFormValues) => Promise<void>;
    onCancel: () => void;
}) {
    const form = useForm<LeaveTypeFormValues>({
        resolver: zodResolver(leaveTypeSchema),
        defaultValues: {
            name: '',
            days_count: 0,
            reset_period: 'yearly',
            carry_forward: false,
            carry_forward_max: '',
            ...defaultValues,
        },
    });
    const carryForward = form.watch('carry_forward');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Leave Type Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Annual Leave" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="days_count" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Days Count</FormLabel>
                            <FormControl><Input type="number" min={0} {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="reset_period" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Reset Period</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="carry_forward" render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0 rounded-md border p-3">
                        <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                            <FormLabel className="cursor-pointer">Allow Carry Forward</FormLabel>
                            <FormDescription>Unused days roll over to the next period.</FormDescription>
                        </div>
                    </FormItem>
                )} />
                {carryForward && (
                    <FormField control={form.control} name="carry_forward_max" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Max Carry Forward Days</FormLabel>
                            <FormControl><Input type="number" min={0} placeholder="Leave blank for no limit" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </div>
            </form>
        </Form>
    );
}

// ─── Scheme row with expandable leave types ───────────────────────────────────

function SchemeRow({
    scheme,
    onEdit,
    onDelete,
    onToggleActive,
    onRefresh,
}: {
    scheme: LeaveScheme;
    onEdit: (scheme: LeaveScheme) => void;
    onDelete: (id: string) => void;
    onToggleActive: (scheme: LeaveScheme) => void;
    onRefresh: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [addTypeOpen, setAddTypeOpen] = useState(false);
    const [editingType, setEditingType] = useState<LeaveSchemeType | null>(null);
    const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
    const { toast } = useToast();
    const types = scheme.leave_scheme_types ?? [];

    const toApiPayload = (values: LeaveTypeFormValues) => {
        const { carry_forward_max, ...rest } = values;
        return {
            ...rest,
            carry_forward_max: values.carry_forward && carry_forward_max ? parseInt(carry_forward_max, 10) : null,
        };
    };

    const handleAddType = async (values: LeaveTypeFormValues) => {
        try {
            const res = await fetch('/api/hrms/leave-scheme-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheme_id: scheme.id, ...toApiPayload(values) }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Added', description: 'Leave type added.' });
            setAddTypeOpen(false);
            onRefresh();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleEditType = async (values: LeaveTypeFormValues) => {
        if (!editingType) return;
        try {
            const res = await fetch('/api/hrms/leave-scheme-types', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingType.id, ...toApiPayload(values) }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Updated', description: 'Leave type updated.' });
            setEditingType(null);
            onRefresh();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleDeleteType = async () => {
        if (!deletingTypeId) return;
        try {
            const res = await fetch(`/api/hrms/leave-scheme-types?id=${deletingTypeId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Deleted', description: 'Leave type deleted.' });
            setDeletingTypeId(null);
            onRefresh();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    return (
        <>
            <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(e => !e)}>
                <TableCell className="w-8">
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </TableCell>
                <TableCell className="font-medium">{scheme.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{scheme.description || '—'}</TableCell>
                <TableCell>
                    <Badge variant="outline">{types.length} type{types.length !== 1 ? 's' : ''}</Badge>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                    <Switch
                        checked={scheme.is_active}
                        onCheckedChange={() => onToggleActive(scheme)}
                    />
                </TableCell>
                <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => onEdit(scheme)}>
                        <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(scheme.id)}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </TableCell>
            </TableRow>

            {expanded && (
                <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <div className="px-8 py-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Leave Types</p>
                                <Button size="sm" variant="outline" onClick={() => setAddTypeOpen(true)}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Type
                                </Button>
                            </div>
                            {types.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No leave types defined for this scheme.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Days</TableHead>
                                            <TableHead>Reset Period</TableHead>
                                            <TableHead>Carry Forward</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {types.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell>{t.name}</TableCell>
                                                <TableCell>{t.days_count}</TableCell>
                                                <TableCell className="capitalize">{t.reset_period}</TableCell>
                                                <TableCell>
                                                    {t.carry_forward
                                                        ? `Yes${t.carry_forward_max != null ? ` (max ${t.carry_forward_max})` : ''}`
                                                        : 'No'}
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => setEditingType(t)}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="sm" variant="destructive" onClick={() => setDeletingTypeId(t.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}

            <Dialog open={addTypeOpen} onOpenChange={setAddTypeOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Leave Type to "{scheme.name}"</DialogTitle></DialogHeader>
                    <LeaveTypeForm onSubmit={handleAddType} onCancel={() => setAddTypeOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingType} onOpenChange={open => { if (!open) setEditingType(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Leave Type</DialogTitle></DialogHeader>
                    {editingType && (
                        <LeaveTypeForm
                            defaultValues={{
                                name: editingType.name,
                                days_count: editingType.days_count,
                                reset_period: editingType.reset_period,
                                carry_forward: editingType.carry_forward,
                                carry_forward_max: editingType.carry_forward_max?.toString() ?? '',
                            }}
                            onSubmit={handleEditType}
                            onCancel={() => setEditingType(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingTypeId} onOpenChange={open => { if (!open) setDeletingTypeId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Leave Type?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will also affect any leave requests using this type.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteType}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LeaveSchemes() {
    const [schemes, setSchemes] = useState<LeaveScheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingScheme, setEditingScheme] = useState<LeaveScheme | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchSchemes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/leave-schemes');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSchemes(data.schemes ?? []);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSchemes(); }, []);

    const handleCreate = async (values: SchemeFormValues) => {
        try {
            const res = await fetch('/api/hrms/leave-schemes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Created', description: 'Leave scheme created.' });
            setIsCreateOpen(false);
            fetchSchemes();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleEdit = async (values: SchemeFormValues) => {
        if (!editingScheme) return;
        try {
            const res = await fetch('/api/hrms/leave-schemes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingScheme.id, ...values }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Updated', description: 'Leave scheme updated.' });
            setEditingScheme(null);
            fetchSchemes();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleToggleActive = async (scheme: LeaveScheme) => {
        try {
            const res = await fetch('/api/hrms/leave-schemes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: scheme.id, is_active: !scheme.is_active }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchSchemes();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            const res = await fetch(`/api/hrms/leave-schemes?id=${deletingId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Deleted', description: 'Leave scheme deleted.' });
            setDeletingId(null);
            fetchSchemes();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Leave Schemes</h1>
                    <p className="text-muted-foreground">Define leave policies and their entitlement types.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Scheme
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Configured Schemes</CardTitle>
                    <CardDescription>Click a row to expand and manage leave types within a scheme.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-10 text-muted-foreground">Loading...</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8" />
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Types</TableHead>
                                    <TableHead>Active</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schemes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            No leave schemes configured yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    schemes.map(scheme => (
                                        <SchemeRow
                                            key={scheme.id}
                                            scheme={scheme}
                                            onEdit={setEditingScheme}
                                            onDelete={setDeletingId}
                                            onToggleActive={handleToggleActive}
                                            onRefresh={fetchSchemes}
                                        />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create Leave Scheme</DialogTitle></DialogHeader>
                    <SchemeForm onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingScheme} onOpenChange={open => { if (!open) setEditingScheme(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Leave Scheme</DialogTitle></DialogHeader>
                    {editingScheme && (
                        <SchemeForm
                            defaultValues={{ name: editingScheme.name, description: editingScheme.description }}
                            onSubmit={handleEdit}
                            onCancel={() => setEditingScheme(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingId} onOpenChange={open => { if (!open) setDeletingId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Leave Scheme?</AlertDialogTitle>
                        <AlertDialogDescription>
                            All leave types within this scheme will also be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
