'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import type { ChaletPackage, ChaletRate, ChaletPackageFacility, ChaletRoomCategory, ChaletMealPlan } from '@/lib/types';
import { Pencil, Trash2, Plus, Save, AlertCircle, Coffee, UtensilsCrossed, X, Settings } from 'lucide-react';
import { ExchangeRateCard } from '@/components/dashboard/chalet/exchange-rate-card';

const emptyPackageForm = {
    name: '',
    description: '',
    meal_plan_id: '',
    meal_plan: '',
    includes_breakfast: false,
    includes_lunch: false,
    includes_dinner: false,
    facilities: [] as ChaletPackageFacility[],
    sort_order: 0,
    is_active: true,
};

const emptyMealPlanForm = {
    name: '',
    description: '',
    food_items: [] as Array<{ id: string; name: string; rate: number }>,
    other_costs: [] as Array<{ id: string; name: string; rate: number }>,
    sort_order: 0,
    is_active: true,
};

const defaultBillSettings = {
    service_charge_pct: 10,
    service_charge_currency: 'both' as 'LKR' | 'USD' | 'both',
    vat_pct: 18,
    vat_currency: 'both' as 'LKR' | 'USD' | 'both',
    sscl_pct: 2.5,
    sscl_currency: 'both' as 'LKR' | 'USD' | 'both',
};

function discountAmount(amount: number, percent: number, fixedValue: number) {
    const fixed = Math.max(0, fixedValue);
    if (fixed > 0) return Math.min(amount, fixed);
    return amount * Math.min(100, Math.max(0, percent)) / 100;
}

function applyDiscount(amount: number, percent: number, fixedValue: number) {
    return Math.max(0, amount - discountAmount(amount, percent, fixedValue));
}

function percentageFromFixed(amount: number, fixedValue: number) {
    if (amount <= 0) return 0;
    return Math.min(100, (Math.max(0, fixedValue) / amount) * 100);
}

export default function ChaletRatesPage() {
    const { toast } = useToast();

    const [packages, setPackages] = useState<ChaletPackage[]>([]);
    const [mealPlans, setMealPlans] = useState<ChaletMealPlan[]>([]);
    const [roomCategories, setRoomCategories] = useState<ChaletRoomCategory[]>([]);
    const [rates, setRates] = useState<ChaletRate[]>([]);
    const [loading, setLoading] = useState(true);

    // Rate matrix: rateMatrix[room_category_or_default][package_id] = rate_per_night
    const [rateMatrix, setRateMatrix] = useState<Record<string, Record<string, number>>>({});
    const [usdRateMatrix, setUsdRateMatrix] = useState<Record<string, Record<string, number>>>({});
    const [offerNameMatrix, setOfferNameMatrix] = useState<Record<string, Record<string, string>>>({});
    const [lkrDiscountValueMatrix, setLkrDiscountValueMatrix] = useState<Record<string, Record<string, number>>>({});
    const [lkrDiscountFixedMatrix, setLkrDiscountFixedMatrix] = useState<Record<string, Record<string, number>>>({});
    const [usdDiscountValueMatrix, setUsdDiscountValueMatrix] = useState<Record<string, Record<string, number>>>({});
    const [usdDiscountFixedMatrix, setUsdDiscountFixedMatrix] = useState<Record<string, Record<string, number>>>({});
    const [usdToLkrRate, setUsdToLkrRate] = useState(0);
    // 'auto': the live daily rate is used and the field below is read-only.
    const [fxMode, setFxMode] = useState<'auto' | 'manual'>('manual');
    const handleExchangeRateChange = useCallback((rate: number, mode: 'auto' | 'manual') => {
        setFxMode(mode);
        if (rate > 0) setUsdToLkrRate(rate);
    }, []);
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
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [mealPlanDialogOpen, setMealPlanDialogOpen] = useState(false);
    const [editingMealPlanId, setEditingMealPlanId] = useState<string | null>(null);
    const [mealPlanForm, setMealPlanForm] = useState({ ...emptyMealPlanForm });
    const [savingMealPlan, setSavingMealPlan] = useState(false);
    const [billSettings, setBillSettings] = useState({ ...defaultBillSettings });
    const [savingBillSettings, setSavingBillSettings] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [pkgRes, rateRes, catRes, mealPlanRes, settingsRes] = await Promise.all([
                fetch('/api/chalet/packages'),
                fetch('/api/chalet/rates'),
                fetch('/api/chalet/room-categories'),
                fetch('/api/chalet/meal-plans'),
                fetch('/api/admin/app-settings?key=chalet_bill_settings').catch(() => null),
            ]);
            const [pkgData, rateData, catData, mealPlanData, settingsData] = await Promise.all([
                pkgRes.json(), rateRes.json(), catRes.json(), mealPlanRes.json(), settingsRes ? settingsRes.json() : Promise.resolve({ value: null }),
            ]);
            setPackages(pkgData.packages || []);
            setRoomCategories(catData.categories || []);
            setMealPlans(mealPlanData.mealPlans || []);
            if (settingsData.value) setBillSettings({ ...defaultBillSettings, ...settingsData.value });
            const ratesArr: ChaletRate[] = rateData.rates || [];
            setRates(ratesArr);

            // Build matrix
            const matrix: Record<string, Record<string, number>> = {};
            const usdMatrix: Record<string, Record<string, number>> = {};
            const offerMatrix: Record<string, Record<string, string>> = {};
            const lkrDiscountValues: Record<string, Record<string, number>> = {};
            const lkrDiscountFixedValues: Record<string, Record<string, number>> = {};
            const usdDiscountValues: Record<string, Record<string, number>> = {};
            const usdDiscountFixedValues: Record<string, Record<string, number>> = {};
            ratesArr.forEach(r => {
                if (r.occupancy_type_id) return;
                const categoryKey = r.room_category_id || '__default__';
                if (!matrix[categoryKey]) matrix[categoryKey] = {};
                if (!usdMatrix[categoryKey]) usdMatrix[categoryKey] = {};
                if (!offerMatrix[categoryKey]) offerMatrix[categoryKey] = {};
                if (!lkrDiscountValues[categoryKey]) lkrDiscountValues[categoryKey] = {};
                if (!lkrDiscountFixedValues[categoryKey]) lkrDiscountFixedValues[categoryKey] = {};
                if (!usdDiscountValues[categoryKey]) usdDiscountValues[categoryKey] = {};
                if (!usdDiscountFixedValues[categoryKey]) usdDiscountFixedValues[categoryKey] = {};
                matrix[categoryKey][r.package_id] = Number(r.rate_per_night);
                usdMatrix[categoryKey][r.package_id] = Number(r.usd_rate_per_night || 0);
                offerMatrix[categoryKey][r.package_id] = r.offer_name || '';
                lkrDiscountValues[categoryKey][r.package_id] = Number(r.lkr_discount_value ?? r.discount_percent ?? 0);
                lkrDiscountFixedValues[categoryKey][r.package_id] = Number(r.lkr_discount_fixed_value || 0);
                usdDiscountValues[categoryKey][r.package_id] = Number(r.usd_discount_value ?? r.discount_percent ?? 0);
                usdDiscountFixedValues[categoryKey][r.package_id] = Number(r.usd_discount_fixed_value || 0);
            });
            setRateMatrix(matrix);
            setUsdRateMatrix(usdMatrix);
            setOfferNameMatrix(offerMatrix);
            setLkrDiscountValueMatrix(lkrDiscountValues);
            setLkrDiscountFixedMatrix(lkrDiscountFixedValues);
            setUsdDiscountValueMatrix(usdDiscountValues);
            setUsdDiscountFixedMatrix(usdDiscountFixedValues);
            setUsdToLkrRate(Number(ratesArr.find(r => Number(r.usd_to_lkr_rate || 0) > 0)?.usd_to_lkr_rate || 0));
        } catch {
            toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRateChange = (categoryId: string, packageId: string, value: string) => {
        const num = parseFloat(value) || 0;
        setRateMatrix(prev => ({
            ...prev,
            [categoryId]: {
                ...(prev[categoryId] || {}),
                [packageId]: num,
            },
        }));
        const percent = lkrDiscountValueMatrix[categoryId]?.[packageId] ?? 0;
        setNestedDiscountValue(setLkrDiscountFixedMatrix, categoryId, packageId, String(num * Math.min(100, Math.max(0, percent)) / 100));
    };

    const handleUsdRateChange = (categoryId: string, packageId: string, value: string) => {
        const num = parseFloat(value) || 0;
        setUsdRateMatrix(prev => ({
            ...prev,
            [categoryId]: {
                ...(prev[categoryId] || {}),
                [packageId]: num,
            },
        }));
        const percent = usdDiscountValueMatrix[categoryId]?.[packageId] ?? 0;
        setNestedDiscountValue(setUsdDiscountFixedMatrix, categoryId, packageId, String(num * Math.min(100, Math.max(0, percent)) / 100));
    };

    const handleOfferNameChange = (categoryId: string, packageId: string, value: string) => {
        setOfferNameMatrix(prev => ({
            ...prev,
            [categoryId]: {
                ...(prev[categoryId] || {}),
                [packageId]: value,
            },
        }));
    };

    const setNestedDiscountValue = (setter: typeof setLkrDiscountValueMatrix, categoryId: string, packageId: string, value: string) => {
        const num = Math.max(0, parseFloat(value) || 0);
        setter(prev => ({
            ...prev,
            [categoryId]: {
                ...(prev[categoryId] || {}),
                [packageId]: num,
            },
        }));
    };

    const handleLkrPercentChange = (categoryId: string, packageId: string, value: string) => {
        const percent = Math.min(100, Math.max(0, parseFloat(value) || 0));
        const rate = rateMatrix[categoryId]?.[packageId] ?? 0;
        setNestedDiscountValue(setLkrDiscountValueMatrix, categoryId, packageId, String(percent));
        setNestedDiscountValue(setLkrDiscountFixedMatrix, categoryId, packageId, String(rate * percent / 100));
    };

    const handleLkrFixedChange = (categoryId: string, packageId: string, value: string) => {
        const fixed = Math.max(0, parseFloat(value) || 0);
        const rate = rateMatrix[categoryId]?.[packageId] ?? 0;
        setNestedDiscountValue(setLkrDiscountFixedMatrix, categoryId, packageId, String(fixed));
        setNestedDiscountValue(setLkrDiscountValueMatrix, categoryId, packageId, String(percentageFromFixed(rate, fixed)));
    };

    const handleUsdPercentChange = (categoryId: string, packageId: string, value: string) => {
        const percent = Math.min(100, Math.max(0, parseFloat(value) || 0));
        const rate = usdRateMatrix[categoryId]?.[packageId] ?? 0;
        setNestedDiscountValue(setUsdDiscountValueMatrix, categoryId, packageId, String(percent));
        setNestedDiscountValue(setUsdDiscountFixedMatrix, categoryId, packageId, String(rate * percent / 100));
    };

    const handleUsdFixedChange = (categoryId: string, packageId: string, value: string) => {
        const fixed = Math.max(0, parseFloat(value) || 0);
        const rate = usdRateMatrix[categoryId]?.[packageId] ?? 0;
        setNestedDiscountValue(setUsdDiscountFixedMatrix, categoryId, packageId, String(fixed));
        setNestedDiscountValue(setUsdDiscountValueMatrix, categoryId, packageId, String(percentageFromFixed(rate, fixed)));
    };

    const handleSaveRates = async () => {
        setSavingRates(true);
        try {
            const payload: { room_category_id?: string | null; package_id: string; rate_per_night: number; usd_rate_per_night: number; usd_to_lkr_rate: number; offer_name: string; discount_percent: number; lkr_discount_value: number; lkr_discount_fixed_value: number; usd_discount_value: number; usd_discount_fixed_value: number }[] = [];
            const categoryRows = ['__default__', ...roomCategories.map(category => category.id)];
            categoryRows.forEach(categoryId => {
                packages.forEach(pkg => {
                    const rate = rateMatrix[categoryId]?.[pkg.id] ?? 0;
                    payload.push({
                        room_category_id: categoryId === '__default__' ? null : categoryId,
                        package_id: pkg.id,
                        rate_per_night: rate,
                        usd_rate_per_night: usdRateMatrix[categoryId]?.[pkg.id] ?? 0,
                        usd_to_lkr_rate: usdToLkrRate,
                        offer_name: offerNameMatrix[categoryId]?.[pkg.id] ?? '',
                        discount_percent: lkrDiscountValueMatrix[categoryId]?.[pkg.id] ?? 0,
                        lkr_discount_value: lkrDiscountValueMatrix[categoryId]?.[pkg.id] ?? 0,
                        lkr_discount_fixed_value: lkrDiscountFixedMatrix[categoryId]?.[pkg.id] ?? 0,
                        usd_discount_value: usdDiscountValueMatrix[categoryId]?.[pkg.id] ?? 0,
                        usd_discount_fixed_value: usdDiscountFixedMatrix[categoryId]?.[pkg.id] ?? 0,
                    });
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

    const handleSaveBillSettings = async () => {
        setSavingBillSettings(true);
        try {
            const res = await fetch('/api/admin/app-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'chalet_bill_settings', value: billSettings }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save bill settings');
            toast({ title: 'Saved', description: 'Chalet bill settings saved.' });
            setSettingsDialogOpen(false);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSavingBillSettings(false);
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
            meal_plan_id: pkg.meal_plan_id || '',
            meal_plan: pkg.meal_plan || '',
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
            const selectedMealPlan = mealPlans.find(plan => plan.id === pkgForm.meal_plan_id);
            const payload = {
                ...pkgForm,
                meal_plan: selectedMealPlan?.name || '',
                ...(editingPkgId ? { id: editingPkgId } : {}),
            };
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

    const openNewMealPlan = () => {
        setEditingMealPlanId(null);
        setMealPlanForm({ ...emptyMealPlanForm });
        setMealPlanDialogOpen(true);
    };

    const openEditMealPlan = (plan: ChaletMealPlan) => {
        setEditingMealPlanId(plan.id);
        setMealPlanForm({
            name: plan.name,
            description: plan.description || '',
            food_items: Array.isArray(plan.food_items) ? plan.food_items : [],
            other_costs: Array.isArray(plan.other_costs) ? plan.other_costs : [],
            sort_order: plan.sort_order,
            is_active: plan.is_active,
        });
        setMealPlanDialogOpen(true);
    };

    const addMealPlanLine = (field: 'food_items' | 'other_costs') => {
        setMealPlanForm(prev => ({
            ...prev,
            [field]: [...prev[field], { id: crypto.randomUUID(), name: '', rate: 0 }],
        }));
    };

    const updateMealPlanLine = (field: 'food_items' | 'other_costs', id: string, patch: Partial<{ name: string; rate: number }>) => {
        setMealPlanForm(prev => ({
            ...prev,
            [field]: prev[field].map(item => item.id === id ? { ...item, ...patch } : item),
        }));
    };

    const removeMealPlanLine = (field: 'food_items' | 'other_costs', id: string) => {
        setMealPlanForm(prev => ({
            ...prev,
            [field]: prev[field].filter(item => item.id !== id),
        }));
    };

    const handleSaveMealPlan = async () => {
        if (!mealPlanForm.name.trim()) {
            toast({ title: 'Validation', description: 'Meal plan name is required', variant: 'destructive' });
            return;
        }
        setSavingMealPlan(true);
        try {
            const payload = {
                ...mealPlanForm,
                food_items: mealPlanForm.food_items.filter(item => item.name.trim()).map(item => ({ ...item, name: item.name.trim(), rate: Number(item.rate || 0) })),
                other_costs: mealPlanForm.other_costs.filter(item => item.name.trim()).map(item => ({ ...item, name: item.name.trim(), rate: Number(item.rate || 0) })),
                ...(editingMealPlanId ? { id: editingMealPlanId } : {}),
            };
            const res = await fetch('/api/chalet/meal-plans', {
                method: editingMealPlanId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: editingMealPlanId ? 'Meal plan updated' : 'Meal plan created' });
            setMealPlanDialogOpen(false);
            fetchData();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSavingMealPlan(false);
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Room Rates & Packages</h1>
                    <p className="text-muted-foreground">Manage chalet rate matrix and meal packages</p>
                </div>
                <Button variant="outline" onClick={() => setSettingsDialogOpen(true)} className="gap-2 sm:w-auto">
                    <Settings className="h-4 w-4" />
                    Bill Settings
                </Button>
            </div>

            <Tabs defaultValue="rates">
                <TabsList>
                    <TabsTrigger value="rates">Rate Matrix</TabsTrigger>
                    <TabsTrigger value="packages">Packages</TabsTrigger>
                    <TabsTrigger value="meal-plans">Meal Plans</TabsTrigger>
                </TabsList>

                {/* Rate Matrix Tab */}
                <TabsContent value="rates" className="space-y-4">
                    <div className="mb-4">
                        <ExchangeRateCard onChange={handleExchangeRateChange} />
                    </div>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Rate Matrix</CardTitle>
                                    <CardDescription>Set LKR rates for local guests. For Non Sri Lankan guests, enter USD and the USD to LKR conversion rate; bookings will still save in LKR.</CardDescription>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                    <div className="space-y-1">
                                        <Label>USD to LKR</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            className="h-9 w-full text-right sm:w-36"
                                            value={usdToLkrRate}
                                            disabled={fxMode === 'auto'}
                                            title={fxMode === 'auto' ? 'Set automatically from the live daily rate' : undefined}
                                            onChange={e => setUsdToLkrRate(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <Button onClick={handleSaveRates} disabled={savingRates || loading}>
                                        <Save className="mr-2 h-4 w-4" />
                                        {savingRates ? 'Saving...' : 'Save Matrix'}
                                    </Button>
                                </div>
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
                                                <TableHead className="sticky left-0 z-20 w-48 min-w-48 border-r bg-background shadow-sm">Room Category</TableHead>
                                                {packages.map(pkg => (
                                                    <TableHead key={pkg.id} className="text-center min-w-[520px]">
                                                        <div>{pkg.name}</div>
                                                        <div className="text-xs font-normal text-muted-foreground">Meals: {mealIcon(pkg)}</div>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {[
                                                { id: '__default__', name: 'Default Rates', description: 'Fallback when a room category rate is not set' },
                                                ...roomCategories.map(category => ({
                                                    id: category.id,
                                                    name: category.name,
                                                    description: `Max ${category.max_guests} guests`,
                                                })),
                                            ].map(row => (
                                                <TableRow key={row.id}>
                                                    <TableCell className="sticky left-0 z-10 min-w-48 border-r bg-background font-medium shadow-sm">
                                                        <div>{row.name}</div>
                                                        <div className="text-xs font-normal text-muted-foreground">{row.description}</div>
                                                    </TableCell>
                                                    {packages.map(pkg => (
                                                        <TableCell key={pkg.id} className="p-3 align-top">
                                                            <div className="space-y-4">
                                                                <div className="rounded-md border bg-muted/20 p-3">
                                                                    <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Base Rates</p>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-1.5">
                                                                            <span className="text-[11px] font-medium text-muted-foreground">LKR</span>
                                                                            <Input
                                                                                type="number"
                                                                                min={0}
                                                                                step={50}
                                                                                className="h-9 text-right text-sm"
                                                                                value={rateMatrix[row.id]?.[pkg.id] ?? 0}
                                                                                onChange={e => handleRateChange(row.id, pkg.id, e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <span className="text-[11px] font-medium text-muted-foreground">USD</span>
                                                                            <div className="relative">
                                                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">$</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    step={1}
                                                                                    className="h-9 pl-7 text-right text-sm"
                                                                                    value={usdRateMatrix[row.id]?.[pkg.id] ?? 0}
                                                                                    onChange={e => handleUsdRateChange(row.id, pkg.id, e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <p className="text-right text-xs text-muted-foreground">
                                                                                LKR {((usdRateMatrix[row.id]?.[pkg.id] ?? 0) * usdToLkrRate).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="rounded-md border p-3">
                                                                    <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Offer</p>
                                                                    <Input
                                                                        className="h-9 text-sm"
                                                                        placeholder="Summer Offer"
                                                                        value={offerNameMatrix[row.id]?.[pkg.id] ?? ''}
                                                                        onChange={e => handleOfferNameChange(row.id, pkg.id, e.target.value)}
                                                                    />
                                                                </div>

                                                                <div className="rounded-md border p-3">
                                                                    <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Discounts</p>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-1.5">
                                                                                <span className="text-[11px] font-medium text-muted-foreground">Percentage (%)</span>
                                                                                <div className="relative">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        step={0.01}
                                                                                        className="h-9 pr-7 text-right text-sm"
                                                                                        value={lkrDiscountValueMatrix[row.id]?.[pkg.id] ?? 0}
                                                                                        onChange={e => handleLkrPercentChange(row.id, pkg.id, e.target.value)}
                                                                                    />
                                                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">%</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                <span className="text-[11px] font-medium text-muted-foreground">Reduce Price (LKR)</span>
                                                                                <div className="relative">
                                                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">LKR</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        step={0.01}
                                                                                        className="h-9 pl-12 text-right text-sm"
                                                                                        value={lkrDiscountFixedMatrix[row.id]?.[pkg.id] ?? 0}
                                                                                        onChange={e => handleLkrFixedChange(row.id, pkg.id, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-right text-xs text-muted-foreground">
                                                                                After: LKR {applyDiscount(rateMatrix[row.id]?.[pkg.id] ?? 0, lkrDiscountValueMatrix[row.id]?.[pkg.id] ?? 0, lkrDiscountFixedMatrix[row.id]?.[pkg.id] ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                                                            </p>
                                                                        </div>

                                                                        <div className="space-y-3 border-l pl-4">
                                                                            <div className="space-y-1.5">
                                                                                <span className="text-[11px] font-medium text-muted-foreground">Percentage (%)</span>
                                                                                <div className="relative">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        step={0.01}
                                                                                        className="h-9 pr-7 text-right text-sm"
                                                                                        value={usdDiscountValueMatrix[row.id]?.[pkg.id] ?? 0}
                                                                                        onChange={e => handleUsdPercentChange(row.id, pkg.id, e.target.value)}
                                                                                    />
                                                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">%</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                <span className="text-[11px] font-medium text-muted-foreground">Reduce Price (USD)</span>
                                                                                <div className="relative">
                                                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">$</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        step={0.01}
                                                                                        className="h-9 pl-7 text-right text-sm"
                                                                                        value={usdDiscountFixedMatrix[row.id]?.[pkg.id] ?? 0}
                                                                                        onChange={e => handleUsdFixedChange(row.id, pkg.id, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-right text-xs text-muted-foreground">
                                                                                After: USD {applyDiscount(usdRateMatrix[row.id]?.[pkg.id] ?? 0, usdDiscountValueMatrix[row.id]?.[pkg.id] ?? 0, usdDiscountFixedMatrix[row.id]?.[pkg.id] ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <p className="text-xs text-muted-foreground mt-3 text-right">* Non Sri Lankan USD prices are converted and saved as LKR on bookings. A 10% service charge will be added on bookings.</p>
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
                                            <TableHead>Meal Plan</TableHead>
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
                                                <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{pkg.meal_plan || '—'}</TableCell>
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

                <TabsContent value="meal-plans" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={openNewMealPlan}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Meal Plan
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
                                            <TableHead>Name</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-center">Order</TableHead>
                                            <TableHead className="text-center">Active</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mealPlans.map(plan => (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-medium">{plan.name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-md truncate">{plan.description || '—'}</TableCell>
                                                <TableCell className="text-center text-sm">{plan.sort_order}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={plan.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'}>
                                                        {plan.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="outline" onClick={() => openEditMealPlan(plan)}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {mealPlans.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                                    No meal plans created yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : null}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Bill Settings
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_160px]">
                            <div className="space-y-1">
                                <Label>Service Charge (%)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={billSettings.service_charge_pct}
                                    onChange={e => setBillSettings(p => ({ ...p, service_charge_pct: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Applies To</Label>
                                <Select value={billSettings.service_charge_currency} onValueChange={value => setBillSettings(p => ({ ...p, service_charge_currency: value as 'LKR' | 'USD' | 'both' }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="both">Both</SelectItem>
                                        <SelectItem value="LKR">LKR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_160px]">
                            <div className="space-y-1">
                                <Label>VAT (%)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={billSettings.vat_pct}
                                    onChange={e => setBillSettings(p => ({ ...p, vat_pct: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Applies To</Label>
                                <Select value={billSettings.vat_currency} onValueChange={value => setBillSettings(p => ({ ...p, vat_currency: value as 'LKR' | 'USD' | 'both' }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="both">Both</SelectItem>
                                        <SelectItem value="LKR">LKR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_160px]">
                            <div className="space-y-1">
                                <Label>SSCL (%)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={billSettings.sscl_pct}
                                    onChange={e => setBillSettings(p => ({ ...p, sscl_pct: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Applies To</Label>
                                <Select value={billSettings.sscl_currency} onValueChange={value => setBillSettings(p => ({ ...p, sscl_currency: value as 'LKR' | 'USD' | 'both' }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="both">Both</SelectItem>
                                        <SelectItem value="LKR">LKR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">These settings are used as defaults when creating chalet bookings. Customer bill currency is automatic: Sri Lankan bills show LKR and Non Sri Lankan bills show USD.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveBillSettings} disabled={savingBillSettings}>
                            {savingBillSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={mealPlanDialogOpen} onOpenChange={setMealPlanDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingMealPlanId ? 'Edit Meal Plan' : 'Add Meal Plan'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Meal Plan Name *</Label>
                            <Input value={mealPlanForm.name} onChange={e => setMealPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Bed & breakfast" />
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea value={mealPlanForm.description} onChange={e => setMealPlanForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label>Sort Order</Label>
                            <Input type="number" value={mealPlanForm.sort_order} onChange={e => setMealPlanForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div className="space-y-3 rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <Label>Food Items</Label>
                                    <p className="text-xs text-muted-foreground">Add included or chargeable foods with their rates.</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => addMealPlanLine('food_items')}>
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add Food
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {mealPlanForm.food_items.map(item => (
                                    <div key={item.id} className="grid gap-2 md:grid-cols-[1fr_150px_36px]">
                                        <Input
                                            value={item.name}
                                            onChange={event => updateMealPlanLine('food_items', item.id, { name: event.target.value })}
                                            placeholder="Food name"
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={item.rate}
                                            onChange={event => updateMealPlanLine('food_items', item.id, { rate: parseFloat(event.target.value) || 0 })}
                                            placeholder="Rate"
                                        />
                                        <Button type="button" variant="outline" size="icon" onClick={() => removeMealPlanLine('food_items', item.id)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {mealPlanForm.food_items.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No food items added.</p>
                                ) : null}
                            </div>
                        </div>
                        <div className="space-y-3 rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <Label>Other Costs</Label>
                                    <p className="text-xs text-muted-foreground">Add extras such as service items, supplements, or special charges.</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => addMealPlanLine('other_costs')}>
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add Cost
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {mealPlanForm.other_costs.map(item => (
                                    <div key={item.id} className="grid gap-2 md:grid-cols-[1fr_150px_36px]">
                                        <Input
                                            value={item.name}
                                            onChange={event => updateMealPlanLine('other_costs', item.id, { name: event.target.value })}
                                            placeholder="Cost name"
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={item.rate}
                                            onChange={event => updateMealPlanLine('other_costs', item.id, { rate: parseFloat(event.target.value) || 0 })}
                                            placeholder="Rate"
                                        />
                                        <Button type="button" variant="outline" size="icon" onClick={() => removeMealPlanLine('other_costs', item.id)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {mealPlanForm.other_costs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No other costs added.</p>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label>Active</Label>
                                <p className="text-xs text-muted-foreground">Only active meal plans appear in package dropdowns.</p>
                            </div>
                            <Switch checked={mealPlanForm.is_active} onCheckedChange={v => setMealPlanForm(p => ({ ...p, is_active: v }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMealPlanDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveMealPlan} disabled={savingMealPlan}>
                            {savingMealPlan ? 'Saving...' : 'Save Meal Plan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <div className="space-y-1">
                            <Label>Meal Plan</Label>
                            <Select value={pkgForm.meal_plan_id || 'none'} onValueChange={value => {
                                const mealPlan = mealPlans.find(plan => plan.id === value);
                                setPkgForm(p => ({
                                    ...p,
                                    meal_plan_id: value === 'none' ? '' : value,
                                    meal_plan: mealPlan?.name || '',
                                }));
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select meal plan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No meal plan</SelectItem>
                                    {mealPlans.filter(plan => plan.is_active || plan.id === pkgForm.meal_plan_id).map(plan => (
                                        <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
