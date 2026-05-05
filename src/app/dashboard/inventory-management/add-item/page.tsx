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
    Scale,
    Plus,
    AlertCircle
} from 'lucide-react';
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
    const [sizes, setSizes] = useState<{ id: string, name: string }[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        category_id: '',
        unit_id: '',
        brand: '',
        item_size: '',
        status: 'active' as 'active' | 'inactive'
    });

    const fetchMetadata = async () => {
        try {
            const [catRes, unitRes, itemsRes, sizesRes] = await Promise.all([
                fetch('/api/admin/inventory/categories'),
                fetch('/api/admin/inventory/units'),
                fetch('/api/admin/inventory/items?includeStock=false'),
                fetch('/api/admin/inventory/sizes')
            ]);
            const catData = await catRes.json();
            const unitData = await unitRes.json();
            const itemsData = await itemsRes.json();

            const sizesData = await sizesRes.json();
            
            setCategories(catData.categories || []);
            setUnits(unitData.units || []);
            setItems(itemsData.items || []);
            setSizes(sizesData.sizes || []);
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
                brand: existing.brand || '',
                item_size: existing.item_size || ''
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

    const handleCreateSize = async (name: string) => {
        try {
            const res = await fetch('/api/admin/inventory/sizes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (data.size) {
                setSizes(prev => [...prev, data.size]);
                setFormData(prev => ({ ...prev, item_size: data.size.name }));
                toast({ title: "Size Created", description: `"${name}" added to master data.` });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to create size attribute." });
        }
    };

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
                            <CardDescription>Define the brand and packaging specifications.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="grid gap-2">
                                <Label htmlFor="item_size" className="text-xs font-bold uppercase tracking-wider text-slate-500">Package / Size</Label>
                                {isLoadingMetadata ? (
                                    <div className="h-10 bg-slate-100 animate-pulse rounded-md" />
                                ) : (
                                    <CreatableCombobox
                                        options={sizes.map(s => s.name)}
                                        value={formData.item_size}
                                        onValueChange={(val) => {
                                            const existing = sizes.find(s => s.name.toLowerCase() === val.toLowerCase());
                                            if (existing) {
                                                setFormData({ ...formData, item_size: existing.name });
                                            } else if (val) {
                                                handleCreateSize(val);
                                            }
                                        }}
                                        placeholder="e.g. 1L, 500g, Case of 12"
                                        className="bg-white border-slate-200"
                                    />
                                )}
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
        </div>
    );
}
