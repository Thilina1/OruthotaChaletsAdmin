'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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
    AlertCircle,
    Search,
    Pencil,
    X,
    Boxes,
    FileSpreadsheet,
    Download,
    Upload
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
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';

type ExcelItemRow = {
    rowNumber: number;
    name: string;
    code: string;
    description: string;
    category: string;
    categoryId: string;
    unit: string;
    unitId: string;
    brand: string;
    status: 'active' | 'inactive';
    errors: string[];
};

export default function RegisterItemPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [units, setUnits] = useState<{ id: string, name: string }[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [excelRows, setExcelRows] = useState<ExcelItemRow[]>([]);
    const [excelFileName, setExcelFileName] = useState('');
    const [isImporting, setIsImporting] = useState(false);

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

    const downloadExcelTemplate = async () => {
        const headers = ['Item Name*', 'Category*', 'Unit*', 'SKU / Item Code', 'Description', 'Brand', 'Status'];
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Oruthota Chalets';

        const itemSheet = workbook.addWorksheet('Items', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        itemSheet.addRow(headers);
        itemSheet.columns = [
            { key: 'name', width: 28 },
            { key: 'category', width: 24 },
            { key: 'unit', width: 18 },
            { key: 'code', width: 22 },
            { key: 'description', width: 38 },
            { key: 'brand', width: 22 },
            { key: 'status', width: 16 },
        ];
        itemSheet.autoFilter = 'A1:G1';
        itemSheet.getRow(1).height = 26;
        itemSheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF1E40AF' } },
                left: { style: 'thin', color: { argb: 'FF1E40AF' } },
                bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
                right: { style: 'thin', color: { argb: 'FF1E40AF' } },
            };
        });

        const references = workbook.addWorksheet('References');
        references.addRow(['Valid Categories', 'Valid Units', 'Valid Statuses']);
        const maxReferenceRows = Math.max(categories.length, units.length, 2);
        for (let index = 0; index < maxReferenceRows; index += 1) {
            references.addRow([
                categories[index]?.name || '',
                units[index]?.name || '',
                ['active', 'inactive'][index] || '',
            ]);
        }
        references.columns = [{ width: 28 }, { width: 22 }, { width: 18 }];
        references.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
        });

        const categoryEnd = Math.max(categories.length + 1, 2);
        const unitEnd = Math.max(units.length + 1, 2);
        for (let row = 2; row <= 501; row += 1) {
            itemSheet.getCell(`B${row}`).dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [`References!$A$2:$A$${categoryEnd}`],
                showErrorMessage: true,
                errorTitle: 'Invalid Category',
                error: 'Select a category from the dropdown list.',
            };
            itemSheet.getCell(`C${row}`).dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [`References!$B$2:$B$${unitEnd}`],
                showErrorMessage: true,
                errorTitle: 'Invalid Unit',
                error: 'Select a unit from the dropdown list.',
            };
            itemSheet.getCell(`G${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['References!$C$2:$C$3'],
                showErrorMessage: true,
                errorTitle: 'Invalid Status',
                error: 'Select active or inactive.',
            };
        }

        const instructions = workbook.addWorksheet('Instructions');
        instructions.addRows([
            ['Inventory Item Import Instructions', ''],
            ['Required columns', 'Item Name, Category, Unit'],
            ['Dropdown fields', 'Category, Unit, and Status have Excel dropdown lists.'],
            ['Status', 'Optional: active or inactive. Defaults to active.'],
            ['SKU / Item Code', 'Optional. Leave blank to generate automatically.'],
            ['Validation', 'Incomplete, unknown, invalid, or duplicate rows are rejected before import.'],
        ]);
        instructions.columns = [{ width: 24 }, { width: 85 }];
        instructions.getRow(1).height = 28;
        instructions.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Inventory_Item_Import_Template.xlsx';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleExcelFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

            const existingCodes = new Set(items.map(item => String(item.code || '').trim().toLowerCase()).filter(Boolean));
            const existingNameUnits = new Set(items.map(item => `${String(item.name).trim().toLowerCase()}::${item.unit_id}`));
            const fileCodes = new Set<string>();
            const fileNameUnits = new Set<string>();

            const valueFor = (row: Record<string, unknown>, names: string[]) => {
                const entry = Object.entries(row).find(([key]) =>
                    names.includes(key.trim().toLowerCase().replace(/\*/g, ''))
                );
                return String(entry?.[1] ?? '').trim();
            };

            const parsedRows = rawRows.map((raw, index): ExcelItemRow => {
                const name = valueFor(raw, ['item name', 'name']);
                const category = valueFor(raw, ['category']);
                const unit = valueFor(raw, ['unit', 'size attribute']);
                const code = valueFor(raw, ['sku / item code', 'sku', 'item code', 'code']);
                const description = valueFor(raw, ['description']);
                const brand = valueFor(raw, ['brand']);
                const rawStatus = valueFor(raw, ['status']).toLowerCase() || 'active';
                const categoryRecord = categories.find(item => item.name.toLowerCase() === category.toLowerCase());
                const unitRecord = units.find(item => item.name.toLowerCase() === unit.toLowerCase());
                const errors: string[] = [];

                if (!name) errors.push('Item Name is required');
                if (!category) errors.push('Category is required');
                else if (!categoryRecord) errors.push(`Unknown Category: ${category}`);
                if (!unit) errors.push('Unit is required');
                else if (!unitRecord) errors.push(`Unknown Unit: ${unit}`);
                if (!['active', 'inactive'].includes(rawStatus)) errors.push('Status must be active or inactive');

                const normalizedCode = code.toLowerCase();
                if (normalizedCode && (existingCodes.has(normalizedCode) || fileCodes.has(normalizedCode))) {
                    errors.push(`Duplicate SKU / Item Code: ${code}`);
                }

                if (name && unitRecord) {
                    const nameUnitKey = `${name.toLowerCase()}::${unitRecord.id}`;
                    if (existingNameUnits.has(nameUnitKey) || fileNameUnits.has(nameUnitKey)) {
                        errors.push('Duplicate Item Name + Unit');
                    }
                    fileNameUnits.add(nameUnitKey);
                }
                if (normalizedCode) fileCodes.add(normalizedCode);

                return {
                    rowNumber: index + 2,
                    name,
                    code,
                    description,
                    category,
                    categoryId: categoryRecord?.id || '',
                    unit,
                    unitId: unitRecord?.id || '',
                    brand,
                    status: rawStatus === 'inactive' ? 'inactive' : 'active',
                    errors,
                };
            });

            setExcelFileName(file.name);
            setExcelRows(parsedRows);
            toast({
                title: 'Spreadsheet Validated',
                description: `${parsedRows.filter(row => row.errors.length === 0).length} valid, ${parsedRows.filter(row => row.errors.length > 0).length} rejected.`,
            });
        } catch (error: any) {
            setExcelRows([]);
            setExcelFileName('');
            toast({ variant: 'destructive', title: 'Invalid Excel File', description: error.message || 'The spreadsheet could not be read.' });
        }
    };

    const importValidExcelRows = async () => {
        const validRows = excelRows.filter(row => row.errors.length === 0);
        if (validRows.length === 0) return;

        setIsImporting(true);
        const failed = new Map<number, string>();
        let imported = 0;

        for (const row of validRows) {
            try {
                const response = await fetch('/api/admin/inventory/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: row.name,
                        code: row.code || undefined,
                        description: row.description || undefined,
                        category_id: row.categoryId,
                        unit_id: row.unitId,
                        brand: row.brand || undefined,
                        status: row.status,
                    }),
                });
                const data = await response.json();
                if (!response.ok || data.error) throw new Error(data.error || 'Import failed');
                imported += 1;
            } catch (error: any) {
                failed.set(row.rowNumber, error.message || 'Import failed');
            }
        }

        setExcelRows(current => current
            .filter(row => row.errors.length > 0 || failed.has(row.rowNumber))
            .map(row => failed.has(row.rowNumber)
                ? { ...row, errors: [...row.errors, failed.get(row.rowNumber)!] }
                : row
            )
        );
        await fetchMetadata();
        setRegisteredItemsPage(1);
        setIsImporting(false);

        toast({
            variant: failed.size > 0 ? 'destructive' : 'default',
            title: failed.size > 0 ? 'Import Completed with Rejections' : 'Import Complete',
            description: `${imported} item${imported === 1 ? '' : 's'} imported. ${failed.size} failed during saving.`,
        });
    };

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

    const {
        currentPage: registeredItemsPage,
        setCurrentPage: setRegisteredItemsPage,
        totalPages: registeredItemsTotalPages,
        paginatedItems: paginatedRegisteredItems,
        totalItems: registeredItemsTotal,
        itemsPerPage: registeredItemsPerPage,
    } = usePagination(filteredItemsList, 10);

    useEffect(() => {
        setRegisteredItemsPage(1);
    }, [itemSearch, setRegisteredItemsPage]);

    const handleSubmit = async () => {
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

            setFormData({
                name: '',
                code: '',
                description: '',
                category_id: '',
                unit_id: '',
                brand: '',
                status: 'active',
            });
            setDuplicateWarning(null);
            setRegisteredItemsPage(1);
            await fetchMetadata();
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

            <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-primary" /> Excel Item Import
                            </CardTitle>
                            <CardDescription>
                                Download the template, complete it using the provided Category and Unit references, then upload it here.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void downloadExcelTemplate();
                                }}
                                disabled={isLoadingMetadata}
                            >
                                <Download className="h-4 w-4 mr-2" /> Download Template
                            </Button>
                            <Button
                                type="button"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                disabled={isLoadingMetadata || isImporting}
                            >
                                <Upload className="h-4 w-4 mr-2" /> Upload Excel
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleExcelFile}
                            />
                        </div>
                    </div>
                </CardHeader>
                {excelFileName && (
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm">
                                <span className="font-medium">{excelFileName}</span>
                                <span className="text-muted-foreground ml-2">
                                    {excelRows.filter(row => row.errors.length === 0).length} valid · {excelRows.filter(row => row.errors.length > 0).length} rejected
                                </span>
                            </div>
                            <Button
                                type="button"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void importValidExcelRows();
                                }}
                                disabled={isImporting || excelRows.every(row => row.errors.length > 0)}
                            >
                                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                Import Valid Items
                            </Button>
                        </div>
                        <div className="rounded-md border bg-white max-h-80 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-16">Row</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Brand</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Validation</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {excelRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-destructive">
                                                The Items sheet contains no data rows.
                                            </TableCell>
                                        </TableRow>
                                    ) : excelRows.map(row => (
                                        <TableRow key={row.rowNumber} className={row.errors.length > 0 ? 'bg-red-50/60' : ''}>
                                            <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                                            <TableCell className="font-medium">{row.name || '—'}</TableCell>
                                            <TableCell>{row.category || '—'}</TableCell>
                                            <TableCell>{row.unit || '—'}</TableCell>
                                            <TableCell className="font-mono text-xs">{row.code || 'AUTO'}</TableCell>
                                            <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                                                <div className="truncate" title={row.description}>{row.description || '—'}</div>
                                            </TableCell>
                                            <TableCell>{row.brand || '—'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={row.status === 'active'
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-300 bg-slate-50 text-slate-600'}
                                                >
                                                    {row.status === 'active' ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {row.errors.length === 0 ? (
                                                    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">Valid</Badge>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <Badge variant="destructive">Rejected</Badge>
                                                        {row.errors.map((error, index) => (
                                                            <div key={index} className="text-xs text-destructive">{error}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                </div>
                <div className="space-y-6">
                    <Button
                        type="button"
                        onClick={() => void handleSubmit()}
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
            </div>

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
                                    paginatedRegisteredItems.map(item => (
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
                    {!isLoadingMetadata && filteredItemsList.length > 0 && (
                        <DataTablePagination
                            currentPage={registeredItemsPage}
                            totalPages={registeredItemsTotalPages}
                            totalItems={registeredItemsTotal}
                            itemsPerPage={registeredItemsPerPage}
                            onPageChange={setRegisteredItemsPage}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
