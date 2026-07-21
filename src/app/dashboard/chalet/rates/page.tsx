'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
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
import type { ChaletPackage, ChaletOccupancyType, ChaletRate, ChaletPackageFacility } from '@/lib/types';
import { Pencil, Trash2, Plus, Save, AlertCircle, Coffee, UtensilsCrossed, X } from 'lucide-react';

function formatCurrency(n: number) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: 2 });
}

const emptyPackageForm = {
    name: '',
    description: '',
    includes_breakfast: false,
    includes_lunch: false,
    includes_dinner: false,
    facilities: [] as ChaletPackageFacility[],
    sort_order: 0,
    is_active: true,
};

export default function ChaletRatesPage() {
    const { toast } = useToast();

    const [packages, setPackages] = useState<ChaletPackage[]>([]);
    const [occupancyTypes, setOccupancyTypes] = useState<ChaletOccupancyType[]>([]);
    const [rates, setRates] = useState<ChaletRate[]>([]);
    const [loading, setLoading] = useState(true);

    // Rate matrix: rateMatrix[occupancy_type_id][package_id] = rate_per_night
    const [rateMatrix, setRateMatrix] = useState<Record<string, Record<string, number>>>({});
    const [savingRates, setSavingRates] = useState(false);

    // Package dialog
    const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
    const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
    const [pkgForm, setPkgForm] = useState({ ...emptyPackageForm });
    const [savingPkg, setSavingPkg] = useState(false);
    const [deletePkgId, setDeletePkgId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [newFacilityName, setNewFacilityName] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [pkgRes, occRes, rateRes] = await Promise.all([
                fetch('/api/chalet/packages'),
                fetch('/api/chalet/occupancy-types'),
                fetch('/api/chalet/rates'),
            ]);
            const [pkgData, occData, rateData] = await Promise.all([
                pkgRes.json(), occRes.json(), rateRes.json(),
            ]);
            setPackages(pkgData.packages || []);
            setOccupancyTypes(occData.occupancy_types || []);
            const ratesArr: ChaletRate[] = rateData.rates || [];
            setRates(ratesArr);

            // Build matrix
            const matrix: Record<string, Record<string, number>> = {};
            ratesArr.forEach(r => {
                if (!matrix[r.occupancy_type_id]) matrix[r.occupancy_type_id] = {};
                matrix[r.occupancy_type_id][r.package_id] = Number(r.rate_per_night);
            });
            setRateMatrix(matrix);
        } catch {
            toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRateChange = (occupancyId: string, packageId: string, value: string) => {
        const num = parseFloat(value) || 0;
        setRateMatrix(prev => ({
            ...prev,
            [occupancyId]: { ...(prev[occupancyId] || {}), [packageId]: num },
        }));
    };

    const handleSaveRates = async () => {
        setSavingRates(true);
        try {
            const payload: { package_id: string; occupancy_type_id: string; rate_per_night: number }[] = [];
            occupancyTypes.forEach(ot => {
                packages.forEach(pkg => {
                    const rate = rateMatrix[ot.id]?.[pkg.id] ?? 0;
                    payload.push({ package_id: pkg.id, occupancy_type_id: ot.id, rate_per_night: rate });
                });
            });
            const res = await fetch('/api/chalet/rates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: 'All rates saved successfully' });
            fetchData();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSavingRates(false);
        }
    };

    const openNewPackage = () => {
        setEditingPkgId(null);
        setPkgForm({ ...emptyPackageForm });
        setNewFacilityName('');
        setPkgDialogOpen(true);
    };

    const openEditPackage = (pkg: ChaletPackage) => {
        setEditingPkgId(pkg.id);
        setPkgForm({
            name: pkg.name,
            description: pkg.description || '',
            includes_breakfast: pkg.includes_breakfast,
            includes_lunch: pkg.includes_lunch,
            includes_dinner: pkg.includes_dinner,
            facilities: pkg.facilities || [],
            sort_order: pkg.sort_order,
            is_active: pkg.is_active,
        });
        setPkgDialogOpen(true);
    };

    const addFacility = () => {
        const name = newFacilityName.trim();
        if (!name) return;
        setPkgForm(p => ({
            ...p,
            facilities: [...p.facilities, { id: crypto.randomUUID(), name }],
        }));
        setNewFacilityName('');
    };

    const removeFacility = (id: string) => {
        setPkgForm(p => ({ ...p, facilities: p.facilities.filter(f => f.id !== id) }));
    };

    const handleSavePackage = async () => {
        if (!pkgForm.name) {
            toast({ title: 'Validation', description: 'Package name is required', variant: 'destructive' });
            return;
        }
        setSavingPkg(true);
        try {
            const payload = { ...pkgForm, ...(editingPkgId ? { id: editingPkgId } : {}) };
            const res = await fetch('/api/chalet/packages', {
                method: editingPkgId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: editingPkgId ? 'Package updated' : 'Package created' });
            setPkgDialogOpen(false);
            fetchData();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSavingPkg(false);
        }
    };

    const confirmDeletePackage = (id: string) => {
        setDeletePkgId(id);
        setDeleteDialogOpen(true);
    };

    const handleDeletePackage = async () => {
        if (!deletePkgId) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/chalet/packages?id=${deletePkgId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            toast({ title: 'Deleted', description: 'Package removed' });
            setDeleteDialogOpen(false);
            fetchData();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setDeleting(false);
        }
    };

    const mealIcon = (pkg: ChaletPackage) => {
        const meals = [
            pkg.includes_breakfast && 'B',
            pkg.includes_lunch && 'L',
            pkg.includes_dinner && 'D',
        ].filter(Boolean).join('/');
        return meals || 'None';
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Room Rates & Packages</h1>
                <p className="text-muted-foreground">Manage chalet rate matrix and meal packages</p>
            </div>

            <Tabs defaultValue="rates">
                <TabsList>
                    <TabsTrigger value="rates">Rate Matrix</TabsTrigger>
                    <TabsTrigger value="packages">Packages</TabsTrigger>
                </TabsList>

                {/* Rate Matrix Tab */}
                <TabsContent value="rates" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Rate Matrix</CardTitle>
                                    <CardDescription>Set rates per night (LKR) for each package × occupancy combination. A +10% service charge applies.</CardDescription>
                                </div>
                                <Button onClick={handleSaveRates} disabled={savingRates || loading}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {savingRates ? 'Saving...' : 'Save All Rates'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-36">Occupancy</TableHead>
                                                {packages.map(pkg => (
                                                    <TableHead key={pkg.id} className="text-center min-w-36">
                                                        <div>{pkg.name}</div>
                                                        <div className="text-xs font-normal text-muted-foreground">Meals: {mealIcon(pkg)}</div>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {occupancyTypes.map(ot => (
                                                <TableRow key={ot.id}>
                                                    <TableCell className="font-medium">
                                                        {ot.name}
                                                        <span className="text-xs text-muted-foreground ml-1">(max {ot.max_guests})</span>
                                                    </TableCell>
                                                    {packages.map(pkg => (
                                                        <TableCell key={pkg.id} className="p-1">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={50}
                                                                className="text-right h-9 text-sm"
                                                                value={rateMatrix[ot.id]?.[pkg.id] ?? 0}
                                                                onChange={e => handleRateChange(ot.id, pkg.id, e.target.value)}
                                                            />
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <p className="text-xs text-muted-foreground mt-3 text-right">* All rates are per night (LKR). A 10% service charge will be added on bookings.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Packages Tab */}
                <TabsContent value="packages" className="space-y-4">
                    <div className="flex justify-end">
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
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Package Name</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-center">Breakfast</TableHead>
                                            <TableHead className="text-center">Lunch</TableHead>
                                            <TableHead className="text-center">Dinner</TableHead>
                                            <TableHead className="text-center">Order</TableHead>
                                            <TableHead className="text-center">Active</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {packages.map(pkg => (
                                            <TableRow key={pkg.id}>
                                                <TableCell className="font-medium">{pkg.name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{pkg.description || '—'}</TableCell>
                                                <TableCell className="text-center">
                                                    {pkg.includes_breakfast ? <Coffee className="h-4 w-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {pkg.includes_lunch ? <UtensilsCrossed className="h-4 w-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {pkg.includes_dinner ? <UtensilsCrossed className="h-4 w-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                                                </TableCell>
                                                <TableCell className="text-center text-sm">{pkg.sort_order}</TableCell>
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
                </TabsContent>
            </Tabs>

            {/* Package Dialog */}
            <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingPkgId ? 'Edit Package' : 'Add Package'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Package Name *</Label>
                            <Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Half Board" />
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-3">
                            <Label>Meals Included</Label>
                            <div className="flex items-center justify-between">
                                <Label className="font-normal">Breakfast</Label>
                                <Switch checked={pkgForm.includes_breakfast} onCheckedChange={v => setPkgForm(p => ({ ...p, includes_breakfast: v }))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="font-normal">Lunch</Label>
                                <Switch checked={pkgForm.includes_lunch} onCheckedChange={v => setPkgForm(p => ({ ...p, includes_lunch: v }))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="font-normal">Dinner</Label>
                                <Switch checked={pkgForm.includes_dinner} onCheckedChange={v => setPkgForm(p => ({ ...p, includes_dinner: v }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Additional Facilities</Label>
                            <p className="text-xs text-muted-foreground">Custom facilities guests on this package can use (e.g. Pool Access, Spa, Airport Pickup). Checked off per day during their stay from the Chalet Bookings page.</p>
                            {pkgForm.facilities.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {pkgForm.facilities.map(f => (
                                        <Badge key={f.id} variant="outline" className="gap-1 pr-1">
                                            {f.name}
                                            <button type="button" onClick={() => removeFacility(f.id)} className="rounded-full hover:bg-muted p-0.5">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="e.g. Pool Access"
                                    value={newFacilityName}
                                    onChange={e => setNewFacilityName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFacility(); } }}
                                />
                                <Button type="button" variant="outline" onClick={addFacility}>Add</Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Sort Order</Label>
                                <Input type="number" value={pkgForm.sort_order} onChange={e => setPkgForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-1 flex flex-col justify-end">
                                <div className="flex items-center justify-between">
                                    <Label className="font-normal">Active</Label>
                                    <Switch checked={pkgForm.is_active} onCheckedChange={v => setPkgForm(p => ({ ...p, is_active: v }))} />
                                </div>
                            </div>
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

            {/* Delete Confirm */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            Delete Package
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure? This will also delete all associated rates.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeletePackage} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
