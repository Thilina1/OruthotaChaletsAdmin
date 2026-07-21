'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { BuffetPackage, BuffetOtherCharge } from '@/lib/types';
import { Pencil, Trash2, Plus, AlertCircle } from 'lucide-react';

function formatCurrency(n: number) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function newId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type ItemRow = { _key: string; id?: string; name: string; description: string; price: number; is_active: boolean };

const emptyPackageForm = {
    name: '',
    description: '',
    vat_rate: 0,
    service_charge_rate: 0,
    sort_order: 0,
    is_active: true,
};

export default function BuffetPackagesPage() {
    const { toast } = useToast();

    const [packages, setPackages] = useState<BuffetPackage[]>([]);
    const [loading, setLoading] = useState(true);

    // Package dialog
    const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
    const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
    const [pkgForm, setPkgForm] = useState({ ...emptyPackageForm });
    const [otherCharges, setOtherCharges] = useState<BuffetOtherCharge[]>([]);
    const [itemRows, setItemRows] = useState<ItemRow[]>([]);
    const [originalItemIds, setOriginalItemIds] = useState<string[]>([]);
    const [savingPkg, setSavingPkg] = useState(false);

    // Package delete confirm
    const [deletePkgId, setDeletePkgId] = useState<string | null>(null);
    const [deletePkgDialogOpen, setDeletePkgDialogOpen] = useState(false);
    const [deletingPkg, setDeletingPkg] = useState(false);

    const fetchPackages = useCallback(async (): Promise<BuffetPackage[]> => {
        try {
            const res = await fetch('/api/buffet/packages');
            const data = await res.json();
            const list: BuffetPackage[] = data.packages || [];
            setPackages(list);
            return list;
        } catch {
            toast({ title: 'Error', description: 'Failed to load buffet packages', variant: 'destructive' });
            return [];
        }
    }, [toast]);

    useEffect(() => {
        setLoading(true);
        fetchPackages().finally(() => setLoading(false));
    }, [fetchPackages]);

    // --- Package dialog open/close ---

    const openNewPackage = () => {
        setEditingPkgId(null);
        setPkgForm({ ...emptyPackageForm });
        setOtherCharges([]);
        setItemRows([]);
        setOriginalItemIds([]);
        setPkgDialogOpen(true);
    };

    const openEditPackage = (pkg: BuffetPackage) => {
        setEditingPkgId(pkg.id);
        setPkgForm({
            name: pkg.name,
            description: pkg.description || '',
            vat_rate: pkg.vat_rate,
            service_charge_rate: pkg.service_charge_rate,
            sort_order: pkg.sort_order,
            is_active: pkg.is_active,
        });
        setOtherCharges(pkg.other_charges || []);
        const items = pkg.buffet_menu_items || [];
        setItemRows(items.map(i => ({ _key: i.id, id: i.id, name: i.name, description: i.description || '', price: Number(i.price), is_active: i.is_active })));
        setOriginalItemIds(items.map(i => i.id));
        setPkgDialogOpen(true);
    };

    // --- Other charges row helpers ---

    const addOtherCharge = () => {
        setOtherCharges(prev => [...prev, { id: newId(), name: '', type: 'percentage', value: 0 }]);
    };
    const updateOtherCharge = (id: string, patch: Partial<BuffetOtherCharge>) => {
        setOtherCharges(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    };
    const removeOtherCharge = (id: string) => {
        setOtherCharges(prev => prev.filter(c => c.id !== id));
    };

    // --- Item row helpers ---

    const addItemRow = () => {
        setItemRows(prev => [...prev, { _key: newId(), name: '', description: '', price: 0, is_active: true }]);
    };
    const updateItemRow = (key: string, patch: Partial<ItemRow>) => {
        setItemRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));
    };
    const removeItemRow = (key: string) => {
        setItemRows(prev => prev.filter(r => r._key !== key));
    };

    // --- Save package (+ its items) ---

    const syncItems = async (packageId: string) => {
        const currentIds = itemRows.filter(r => r.id).map(r => r.id as string);
        const removedIds = originalItemIds.filter(id => !currentIds.includes(id));

        await Promise.all([
            ...removedIds.map(id => fetch(`/api/buffet/menu-items?id=${id}`, { method: 'DELETE' })),
            ...itemRows.filter(r => r.name.trim()).map(row => {
                if (row.id) {
                    return fetch('/api/buffet/menu-items', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: row.id, name: row.name, description: row.description, price: row.price, is_active: row.is_active }),
                    });
                }
                return fetch('/api/buffet/menu-items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ package_id: packageId, name: row.name, description: row.description, price: row.price, is_active: row.is_active }),
                });
            }),
        ]);
    };

    const handleSavePackage = async () => {
        if (!pkgForm.name) {
            toast({ title: 'Validation', description: 'Package name is required', variant: 'destructive' });
            return;
        }
        const cleanedCharges = otherCharges.filter(c => c.name.trim());
        setSavingPkg(true);
        try {
            const payload = {
                ...pkgForm,
                other_charges: cleanedCharges,
                ...(editingPkgId ? { id: editingPkgId } : {}),
            };
            const res = await fetch('/api/buffet/packages', {
                method: editingPkgId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const packageId = editingPkgId || data.package.id;
            await syncItems(packageId);

            toast({ title: 'Success', description: editingPkgId ? 'Package updated' : 'Package created' });
            setPkgDialogOpen(false);
            fetchPackages();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSavingPkg(false);
        }
    };

    const confirmDeletePackage = (id: string) => {
        setDeletePkgId(id);
        setDeletePkgDialogOpen(true);
    };

    const handleDeletePackage = async () => {
        if (!deletePkgId) return;
        setDeletingPkg(true);
        try {
            const res = await fetch(`/api/buffet/packages?id=${deletePkgId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            toast({ title: 'Deleted', description: 'Package removed' });
            setDeletePkgDialogOpen(false);
            fetchPackages();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setDeletingPkg(false);
        }
    };

    // Live preview of totals based on the items + charges currently in the form.
    const subtotal = itemRows.filter(r => r.is_active && r.name.trim()).reduce((sum, r) => sum + Number(r.price || 0), 0);
    const serviceChargeAmount = subtotal * (Number(pkgForm.service_charge_rate) / 100);
    const otherChargeAmounts = otherCharges.filter(c => c.name.trim()).map(c => ({
        ...c,
        amount: c.type === 'percentage' ? subtotal * (Number(c.value) / 100) : Number(c.value),
    }));
    const otherChargeTotal = otherChargeAmounts.reduce((sum, c) => sum + c.amount, 0);
    const vatBase = subtotal + serviceChargeAmount + otherChargeTotal;
    const vatAmount = vatBase * (Number(pkgForm.vat_rate) / 100);
    const grandTotal = vatBase + vatAmount;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Buffet Packages</h1>
                    <p className="text-muted-foreground">Create buffet packages with their menu items and set VAT / service charge / other charges.</p>
                </div>
                <Button onClick={openNewPackage}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Package
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                        </div>
                    ) : packages.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center">No buffet packages yet. Click "Add Package" to create one.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Package Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-center">Items</TableHead>
                                    <TableHead className="text-center">VAT %</TableHead>
                                    <TableHead className="text-center">Service Charge %</TableHead>
                                    <TableHead className="text-center">Other Charges</TableHead>
                                    <TableHead className="text-center">Active</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {packages.map(pkg => (
                                    <TableRow key={pkg.id}>
                                        <TableCell className="font-medium">{pkg.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{pkg.description || '—'}</TableCell>
                                        <TableCell className="text-center text-sm">{pkg.buffet_menu_items?.length ?? 0}</TableCell>
                                        <TableCell className="text-center text-sm">{Number(pkg.vat_rate).toFixed(2)}%</TableCell>
                                        <TableCell className="text-center text-sm">{Number(pkg.service_charge_rate).toFixed(2)}%</TableCell>
                                        <TableCell className="text-center text-sm">
                                            {pkg.other_charges?.length
                                                ? pkg.other_charges.map(c => `${c.name} (${c.type === 'percentage' ? `${Number(c.value).toFixed(2)}%` : `LKR ${formatCurrency(Number(c.value))}`})`).join(', ')
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={pkg.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'}>
                                                {pkg.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="sm" variant="outline" onClick={() => openEditPackage(pkg)}>
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => confirmDeletePackage(pkg.id)}>
                                                    <Trash2 className="h-3 w-3" />
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

            {/* Package Dialog (Basic Info + Charges + Menu Items, all in one place) */}
            <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingPkgId ? 'Edit Package' : 'Add Package'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-2 max-h-[75vh] overflow-y-auto pr-1">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label>Package Name *</Label>
                                <Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard Buffet" />
                            </div>
                            <div className="space-y-1">
                                <Label>Description</Label>
                                <Textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <Label>VAT %</Label>
                                    <Input type="number" min={0} step={0.5} value={pkgForm.vat_rate} onChange={e => setPkgForm(p => ({ ...p, vat_rate: parseFloat(e.target.value) || 0 }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Service Charge %</Label>
                                    <Input type="number" min={0} step={0.5} value={pkgForm.service_charge_rate} onChange={e => setPkgForm(p => ({ ...p, service_charge_rate: parseFloat(e.target.value) || 0 }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Sort Order</Label>
                                    <Input type="number" value={pkgForm.sort_order} onChange={e => setPkgForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="font-normal">Active</Label>
                                <Switch checked={pkgForm.is_active} onCheckedChange={v => setPkgForm(p => ({ ...p, is_active: v }))} />
                            </div>
                        </div>

                        {/* Other Charges */}
                        <div className="space-y-2 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <Label>Other Charges</Label>
                                <Button type="button" size="sm" variant="outline" onClick={addOtherCharge}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Charge
                                </Button>
                            </div>
                            {otherCharges.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No extra charges. Add your own — e.g. "Setup Fee", "Delivery Charge".</p>
                            ) : (
                                <div className="space-y-2">
                                    {otherCharges.map(charge => (
                                        <div key={charge.id} className="flex items-center gap-2">
                                            <Input
                                                className="flex-1"
                                                placeholder="Charge name (e.g. Setup Fee)"
                                                value={charge.name}
                                                onChange={e => updateOtherCharge(charge.id, { name: e.target.value })}
                                            />
                                            <Select value={charge.type} onValueChange={(v: 'percentage' | 'fixed') => updateOtherCharge(charge.id, { type: v })}>
                                                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percentage">Percentage %</SelectItem>
                                                    <SelectItem value="fixed">Fixed (LKR)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={charge.type === 'percentage' ? 0.5 : 10}
                                                className="w-28"
                                                value={charge.value}
                                                onChange={e => updateOtherCharge(charge.id, { value: parseFloat(e.target.value) || 0 })}
                                            />
                                            <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => removeOtherCharge(charge.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Menu Items */}
                        <div className="space-y-2 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <Label>Menu Items</Label>
                                <Button type="button" size="sm" variant="outline" onClick={addItemRow}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Item
                                </Button>
                            </div>
                            {itemRows.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No items yet. Add the dishes included in this buffet package.</p>
                            ) : (
                                <div className="space-y-2">
                                    {itemRows.map(row => (
                                        <div key={row._key} className="flex items-start gap-2">
                                            <Input
                                                className="flex-1"
                                                placeholder="Item name"
                                                value={row.name}
                                                onChange={e => updateItemRow(row._key, { name: e.target.value })}
                                            />
                                            <Input
                                                className="flex-1"
                                                placeholder="Description"
                                                value={row.description}
                                                onChange={e => updateItemRow(row._key, { description: e.target.value })}
                                            />
                                            <Input
                                                type="number"
                                                min={0}
                                                step={10}
                                                className="w-28"
                                                placeholder="Price"
                                                value={row.price}
                                                onChange={e => updateItemRow(row._key, { price: parseFloat(e.target.value) || 0 })}
                                            />
                                            <div className="flex items-center h-10">
                                                <Switch checked={row.is_active} onCheckedChange={v => updateItemRow(row._key, { is_active: v })} />
                                            </div>
                                            <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => removeItemRow(row._key)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Live preview */}
                        <div className="border-t pt-3 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Items Subtotal</span><span>LKR {formatCurrency(subtotal)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Service Charge ({Number(pkgForm.service_charge_rate).toFixed(2)}%)</span><span>LKR {formatCurrency(serviceChargeAmount)}</span></div>
                            {otherChargeAmounts.map(c => (
                                <div key={c.id} className="flex justify-between">
                                    <span className="text-muted-foreground">{c.name} ({c.type === 'percentage' ? `${Number(c.value).toFixed(2)}%` : 'fixed'})</span>
                                    <span>LKR {formatCurrency(c.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between"><span className="text-muted-foreground">VAT ({Number(pkgForm.vat_rate).toFixed(2)}%)</span><span>LKR {formatCurrency(vatAmount)}</span></div>
                            <div className="flex justify-between font-semibold pt-1 border-t"><span>Estimated Total (per set)</span><span>LKR {formatCurrency(grandTotal)}</span></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPkgDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSavePackage} disabled={savingPkg}>
                            {savingPkg ? 'Saving...' : editingPkgId ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Package Confirm */}
            <Dialog open={deletePkgDialogOpen} onOpenChange={setDeletePkgDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            Delete Package
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure? This will also delete all menu items in this package.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletePkgDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeletePackage} disabled={deletingPkg}>
                            {deletingPkg ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
