'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Tags, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

type MasterRecord = { id: string; name: string; description?: string; status?: string };
const sections = [
    { key: 'units', label: 'Size Attribute (Label)', singular: 'Size Attribute', description: 'Labels used for item sizes and units, such as kg, ml, or box.' },
    { key: 'categories', label: 'Category', singular: 'Category', description: 'Categories used to organize inventory items.' },
    { key: 'brands', label: 'Brand', singular: 'Brand', description: 'Brands and manufacturers available for inventory items.' },
] as const;
type Section = typeof sections[number];

function MasterSection({ section }: { section: Section }) {
    const { toast } = useToast();
    const [records, setRecords] = useState<MasterRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<MasterRecord | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    async function load() {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/admin/inventory/${section.key}`);
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Unable to load records.');
            setRecords(data[section.key] || []);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to load records.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [section.key]);

    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || saving) return;
        if (records.some(record => record.id !== editing?.id && record.name.trim().toLowerCase() === trimmed.toLowerCase())) {
            toast({ variant: 'destructive', title: 'Already exists', description: `“${trimmed}” is already available.` });
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(`/api/admin/inventory/${section.key}`, {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editing?.id, name: trimmed, description: description.trim() || null }),
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Unable to save record.');
            setOpen(false);
            setSearch('');
            setCurrentPage(1);
            toast({ title: `${section.singular} saved`, description: `“${trimmed}” is now available for inventory items.` });
            await load();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Unable to save', description: error instanceof Error ? error.message : 'Please try again.' });
        } finally {
            setSaving(false);
        }
    }

    const filtered = records.filter(record => `${record.name} ${record.description || ''}`.toLowerCase().includes(search.toLowerCase()));
    const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(filtered, 10);

    useEffect(() => {
        setCurrentPage(page => Math.min(page, Math.max(1, totalPages)));
    }, [totalPages, setCurrentPage]);


    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg">{section.label} <Badge variant="secondary">{records.length}</Badge></CardTitle>
                    <Button size="sm" disabled={loading || !!error} onClick={() => { setEditing(null); setName(''); setDescription(''); setOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Add {section.singular}
                    </Button>
                </div>
                <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Input aria-label={`Search ${section.label}`} placeholder={`Search ${section.label.toLowerCase()}...`} value={search} onChange={event => { setSearch(event.target.value); setCurrentPage(1); }} />
                {error ? (
                    <div role="alert" className="space-y-3 text-sm text-destructive">
                        <p>{error}</p>
                        <Button variant="outline" onClick={() => void load()}>Retry</Button>
                    </div>
                ) : (
                    <div className="max-h-[480px] overflow-auto rounded-md border">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead>Name</TableHead>
                                {section.key !== 'brands' && <><TableHead>Description</TableHead><TableHead>Status</TableHead></>}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {loading || filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={section.key === 'brands' ? 2 : 4} className="py-8 text-center text-muted-foreground">
                                        {loading ? 'Loading...' : search ? 'No matching records.' : `No ${section.label.toLowerCase()} records yet. Add one to get started.`}
                                    </TableCell></TableRow>
                                ) : paginatedItems.map(record => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">{record.name}</TableCell>
                                        {section.key !== 'brands' && <>
                                            <TableCell>{record.description || '—'}</TableCell>
                                            <TableCell><Badge variant="outline">{record.status || 'active'}</Badge></TableCell>
                                        </>}
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" aria-label={`Edit ${record.name}`} onClick={() => {
                                                setEditing(record); setName(record.name); setDescription(record.description || ''); setOpen(true);
                                            }}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {!loading && !error && (
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </CardContent>
            <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit' : 'Add'} {section.singular}</DialogTitle>
                        <DialogDescription>This record will be available when registering inventory items.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={save} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={`${section.key}-name`}>Name</Label>
                            <Input id={`${section.key}-name`} value={name} onChange={event => setName(event.target.value)} required disabled={saving} autoFocus />
                        </div>
                        {section.key !== 'brands' && <div className="space-y-2">
                            <Label htmlFor={`${section.key}-description`}>Description (optional)</Label>
                            <Textarea id={`${section.key}-description`} value={description} onChange={event => setDescription(event.target.value)} disabled={saving} />
                        </div>}
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving || !name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save {section.singular}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

export default function InventoryItemMastersPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="space-y-2">
                <Link href="/dashboard/inventory-management/add-item" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Inventory Items</Link>
                <h1 className="flex items-center gap-3 text-3xl font-headline font-bold"><Tags className="h-8 w-8 text-primary" /> Inventory Item Masters</h1>
                <p className="text-muted-foreground">View, add, and edit the size attributes, categories, and brands used by your inventory items.</p>
            </div>
            <Tabs defaultValue="units" className="space-y-6">
                <TabsList className="flex h-auto flex-wrap justify-start">
                    {sections.map(section => <TabsTrigger key={section.key} value={section.key}>{section.label}</TabsTrigger>)}
                </TabsList>
                {sections.map(section => <TabsContent key={section.key} value={section.key}><MasterSection section={section} /></TabsContent>)}
            </Tabs>
        </div>
    );
}
