'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Banknote } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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

interface AllowanceType {
    id: string;
    name: string;
    default_amount: number;
    created_at: string;
}

const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    default_amount: z.coerce.number().min(0, 'Must be 0 or greater'),
});

export default function AllowanceTypesPage() {
    const { toast } = useToast();
    const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AllowanceType | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: '', default_amount: 0 },
    });

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/allowance-types');
            const data = await res.json();
            setAllowanceTypes(data.allowanceTypes ?? []);
        } catch {
            toast({ title: 'Error', description: 'Failed to load allowance types', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTypes(); }, []);

    const openCreate = () => {
        setEditing(null);
        form.reset({ name: '', default_amount: 0 });
        setDialogOpen(true);
    };

    const openEdit = (at: AllowanceType) => {
        setEditing(at);
        form.reset({ name: at.name, default_amount: at.default_amount });
        setDialogOpen(true);
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setSaving(true);
        try {
            const res = await fetch('/api/hrms/allowance-types', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing ? { id: editing.id, ...values } : values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            const cascadeMsg = editing && data.updatedEmployees > 0
                ? ` ${data.updatedEmployees} employee${data.updatedEmployees !== 1 ? 's' : ''} updated automatically.`
                : '';
            toast({ title: editing ? 'Allowance type updated' : 'Allowance type created', description: cascadeMsg || undefined });
            setDialogOpen(false);
            fetchTypes();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            const res = await fetch(`/api/hrms/allowance-types?id=${deletingId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            toast({ title: 'Allowance type deleted' });
            setDeletingId(null);
            fetchTypes();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Banknote className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Allowance Types</h1>
                        <p className="text-sm text-muted-foreground">Define reusable allowance types that can be assigned to employees.</p>
                    </div>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" /> Add Allowance Type
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Allowance Types</CardTitle>
                    <CardDescription>{allowanceTypes.length} type{allowanceTypes.length !== 1 ? 's' : ''} defined</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                    ) : allowanceTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No allowance types yet. Click "Add Allowance Type" to create one.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Default Amount (LKR)</TableHead>
                                    <TableHead className="w-24 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allowanceTypes.map((at) => (
                                    <TableRow key={at.id}>
                                        <TableCell className="font-medium">{at.name}</TableCell>
                                        <TableCell className="text-right">
                                            {at.default_amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => openEdit(at)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletingId(at.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Allowance Type' : 'New Allowance Type'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Transport Allowance" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="default_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Default Amount (LKR)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Allowance Type?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the allowance type. Existing employee allowances that used this type will not be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
