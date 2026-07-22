'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
    PackagePlus,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    Barcode,
    Tag,
    Layers,
    AlertCircle,
    Search,
    Pencil,
    X,
    Boxes
} from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';


export default function RegisterItemPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [units, setUnits] = useState<{ id: string, name: string }[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

    // Registered items list — inline name editing
    const [itemSearch, setItemSearch] = useState('');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        category_id: '',
        unit_id: '',
        brand: '',
        status: 'active' as 'active' | 'inactive'
    });

    const fetchMetadata = async () => {
        try {
            const [catRes, unitRes, itemsRes] = await Promise.all([
                fetch('/api/admin/inventory/categories'),
                fetch('/api/admin/inventory/units'),
                fetch('/api/admin/inventory/items?includeStock=false'),
            ]);
            const catData = await catRes.json();
            const unitData = await unitRes.json();
            const itemsData = await itemsRes.json();

            setCategories(catData.categories || []);
            setUnits(unitData.units || []);
            setItems(itemsData.items || []);
        } catch (error) {
            console.error("Error fetching metadata:", error);
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    // Check for duplicates (both Name+Unit and SKU)
    useEffect(() => {
        let warning = null;

        if (formData.name && formData.unit_id) {
            const nameUnitDuplicate = items.find(i =>
                i.name.toLowerCase() === formData.name.toLowerCase() &&
                i.unit_id === formData.unit_id
            );
            if (nameUnitDuplicate) {
                warning = `Item "${formData.name}" is already registered with this unit.`;
            }
        }

        if (!warning && formData.code && formData.code !== 'AUTO') {
            const skuDuplicate = items.find(i =>
                i.code.toLowerCase() === formData.code.toLowerCase()
            );
            if (skuDuplicate) {
                warning = `The SKU/Code "${formData.code}" is already assigned to "${skuDuplicate.name}".`;
            }
        }

        setDuplicateWarning(warning);
    }, [formData.name, formData.unit_id, formData.code, items]);

    const handleItemNameSelect = (displayName: string) => {
        // Extract actual name if it follows "Name (Unit)" format
        const nameMatch = displayName.match(/^(.*?)(?:\s\((.*?)\))?$/);
        const actualName = nameMatch ? nameMatch[1] : displayName;
        const unitHint = nameMatch ? nameMatch[2] : null;

        // Try to find exact item to auto-fill
        const existing = items.find(i => {
            const itemUnitName = units.find(u => u.id === i.unit_id)?.name;
            if (unitHint) {
                return i.name.toLowerCase() === actualName.toLowerCase() &&
                    itemUnitName?.toLowerCase() === unitHint.toLowerCase();
            }
            return i.name.toLowerCase() === actualName.toLowerCase();
        });

        if (existing) {
            setFormData({
                ...formData,
                name: existing.name,
                category_id: existing.category_id,
                unit_id: existing.unit_id,
                code: existing.code,
                description: existing.description || '',
                brand: existing.brand || ''
            });
            setDuplicateWarning(null);
        } else {
            setFormData({ ...formData, name: actualName });
        }
    };

    const handleCreateCategory = async (name: string) => {
        try {
            const res = await fetch('/api/admin/inventory/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (data.category) {
                setCategories(prev => [...prev, data.category]);
                setFormData(prev => ({ ...prev, category_id: data.category.id }));
                toast({ title: "Category Created", description: `"${name}" added to master data.` });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to create category." });
        }
    };

    const handleCreateUnit = async (name: string) => {
        try {
            const res = await fetch('/api/admin/inventory/units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (data.unit) {
                setUnits(prev => [...prev, data.unit]);
                setFormData(prev => ({ ...prev, unit_id: data.unit.id }));
                toast({ title: "Unit Created", description: `"${name}" added to master data.` });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to create unit." });
        }
    };

    const startEditName = (item: any) => {
        setEditingItemId(item.id);
        setEditingName(item.name);
    };

    const cancelEditName = () => {
        setEditingItemId(null);
        setEditingName('');
    };

    const saveEditName = async (item: any) => {
        const trimmed = editingName.trim();
        if (!trimmed || trimmed === item.name) {
            cancelEditName();
            return;
        }
        setIsSavingName(true);
        try {
            const res = await fetch('/api/admin/inventory/items', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    name: trimmed,
                    code: item.code,
                    description: item.description,
                    category_id: item.category_id,
                    unit_id: item.unit_id,
                    item_size: item.item_size,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: trimmed } : i));
            toast({ title: 'Updated', description: `Renamed to "${trimmed}".` });
            cancelEditName();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to rename item.' });
        } finally {
            setIsSavingName(false);
        }
    };

    const filteredItemsList = items.filter(i =>
        i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        i.code?.toLowerCase().includes(itemSearch.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final attempt to resolve any "typed but not selected" values
        let currentCategoryId = formData.category_id;
        let currentUnitId = formData.unit_id;

        setIsSubmitting(true);

        try {
            // Check if we need to create metadata on-the-fly (in case they typed but didn't click Add)
            // Note: This is a backup. Ideal flow is handleCreate* catches it.
            if (!currentCategoryId || !currentUnitId) {
                // If the user typed something in a field but we don't have an ID, 
                // we should check if we can found it in the lists or if we need to block.
                if (!formData.name) {
                    toast({ variant: 'destructive', title: "Missing Name", description: "Item Name is required." });
                    setIsSubmitting(false);
                    return;
                }
            }

            if (!formData.name || !currentCategoryId || !currentUnitId) {
                toast({
                    variant: 'destructive',
                    title: "Missing Selections",
                    description: "Please ensure you have selected or added a Category and Unit."
                });
                setIsSubmitting(false);
                return;
            }

            const res = await fetch('/api/admin/inventory/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    category_id: currentCategoryId,
                    unit_id: currentUnitId
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Item Registered",
                description: `Successfully added "${formData.name}" to inventory master.`,
            });

            router.push('/dashboard/inventory-management');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Registration Failed",
                description: error.message || "Something went wrong."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Link href="/dashboard/inventory-management" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                        <ArrowLeft className="h-3 w-3" /> Back to Inventory
                    </Link>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <PackagePlus className="h-8 w-8 text-primary" />
                        Register New Item
                    </h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Tag className="h-5 w-5 text-primary" /> Core Information
                            </CardTitle>
                            <CardDescription>Primary identification details for the inventory item.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Item Name</Label>
                                <CreatableCombobox
                                    options={items.map(i => {
                                        const unitName = units.find(u => u.id === i.unit_id)?.name;
                                        return unitName ? `${i.name} (${unitName})` : i.name;
                                    })}
                                    value={formData.name}
                                    onValueChange={handleItemNameSelect}
                                    placeholder="Search or type new product name..."
                                    className="bg-white"
                                />
                                {duplicateWarning && (
                                    <div className="flex items-start gap-2 text-[11px] font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 mt-2 animate-in fade-in slide-in-from-top-1">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{duplicateWarning} Please use a different name or unit.</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="unit_id" className="text-xs font-bold uppercase tracking-wider text-slate-500">Size Attribute (Label)</Label>
                                    {isLoadingMetadata ? (
                                        <div className="h-10 bg-slate-100 animate-pulse rounded-md" />
                                    ) : (
                                        <CreatableCombobox
                                            options={units.map(u => u.name)}
                                            value={units.find(u => u.id === formData.unit_id)?.name || ''}
                                            onValueChange={(val) => {
                                                const existing = units.find(u => u.name.toLowerCase() === val.toLowerCase());
                                                if (existing) {
                                                    setFormData({ ...formData, unit_id: existing.id });
                                                } else if (val) {
                                                    handleCreateUnit(val);
                                                }
                                            }}
                                            placeholder="Select or type unit (kg, ml, box...)"
                                            className={cn(
                                                "bg-white border-slate-200",
                                                duplicateWarning && "border-red-300 ring-1 ring-red-300"
                                            )}
                                        />
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="category_id" className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</Label>
                                    {isLoadingMetadata ? (
                                        <div className="h-10 bg-slate-100 animate-pulse rounded-md" />
                                    ) : (
                                        <CreatableCombobox
                                            options={categories.map(c => c.name)}
                                            value={categories.find(c => c.id === formData.category_id)?.name || ''}
                                            onValueChange={(val) => {
                                                const existing = categories.find(c => c.name.toLowerCase() === val.toLowerCase());
                                                if (existing) {
                                                    setFormData({ ...formData, category_id: existing.id });
                                                } else if (val) {
                                                    handleCreateCategory(val);
                                                }
                                            }}
                                            placeholder="Select or type category..."
                                            className="bg-white border-slate-200"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="code" className="text-xs font-bold uppercase tracking-wider">SKU / Item Code</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="code"
                                                placeholder="AUTO-GENERATE"
                                                className={cn(
                                                    "pl-10 bg-white font-mono",
                                                    duplicateWarning?.includes('SKU') && "border-red-300 ring-1 ring-red-300"
                                                )}
                                                value={formData.code}
                                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                                Unique ID. Leave blank for automatic generation.
                                            </p>
                                        </div>
                                        <BarcodeScanner
                                            onScan={(code) => setFormData({ ...formData, code })}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="status" className="text-xs font-bold uppercase tracking-wider">Initial Status</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active (Available for PO)</SelectItem>
                                            <SelectItem value="inactive">Inactive (Hidden)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Additional details, usage instructions, or specialized notes."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="bg-white min-h-[100px]"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" /> Physical Attributes
                            </CardTitle>
                            <CardDescription>Define the brand of this item.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2">
                                <Label htmlFor="brand" className="text-xs font-bold uppercase tracking-wider">Brand</Label>
                                <Input
                                    id="brand"
                                    placeholder="e.g. Nestle, Elephant House"
                                    value={formData.brand}
                                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                    className="bg-white"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Button
                        type="submit"
                        disabled={isSubmitting || isLoadingMetadata || !!duplicateWarning}
                        className={cn(
                            "w-full h-14 font-black uppercase tracking-widest rounded-xl shadow-lg transition-all border-none",
                            duplicateWarning ? "bg-slate-300 cursor-not-allowed opacity-70" : "hover:shadow-primary/30"
                        )}
                    >
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : duplicateWarning ? (
                            <AlertCircle className="mr-2 h-5 w-5" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-300" />
                        )}
                        {duplicateWarning ? "Duplicate Detected" : "Confirm Registration"}
                    </Button>

                    <div className="p-4 bg-slate-100 rounded-xl border border-dashed text-[10px] text-muted-foreground leading-relaxed">
                        Registration adds the product to the global catalog. Stock levels must be initialized via <strong>Stock Intake</strong> or <strong>Goods Receipt</strong>.
                    </div>
                </div>
            </form>

            {/* Registered Items */}
            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Boxes className="h-5 w-5 text-primary" /> Registered Items
                            </CardTitle>
                            <CardDescription>All items added from this page. Click the pencil to rename one.</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or code..."
                                value={itemSearch}
                                onChange={e => setItemSearch(e.target.value)}
                                className="pl-9 bg-white"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingMetadata ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell>
                                    </TableRow>
                                ) : filteredItemsList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            {itemSearch ? 'No items match your search.' : 'No items registered yet.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredItemsList.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {editingItemId === item.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            value={editingName}
                                                            onChange={e => setEditingName(e.target.value)}
                                                            className="h-8 max-w-xs"
                                                            autoFocus
                                                            disabled={isSavingName}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') { e.preventDefault(); saveEditName(item); }
                                                                if (e.key === 'Escape') cancelEditName();
                                                            }}
                                                        />
                                                        <Button size="sm" className="h-8" onClick={() => saveEditName(item)} disabled={isSavingName}>
                                                            {isSavingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelEditName} disabled={isSavingName}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    item.name
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                                            <TableCell className="text-sm">{item.category?.name || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.unit?.name || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.brand || '—'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(item.status === 'active' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500')}>
                                                    {item.status === 'active' ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {editingItemId !== item.id && (
                                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => startEditName(item)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
