'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Warehouse as WarehouseIcon, Link2 } from 'lucide-react';
import type { InventoryWarehouse } from '@/lib/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

interface StoreManagementProps {
    warehouses: InventoryWarehouse[];
    invDepts: { id: string; name: string }[];
    onUpdate: () => Promise<void>;
}

const NONE = '__none__';

const safeJson = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return {}; }
};

export function StoreManagement({ warehouses, invDepts, onUpdate }: StoreManagementProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [updatingMainId, setUpdatingMainId] = useState<string | null>(null);
    const [pendingMainRemoval, setPendingMainRemoval] = useState<InventoryWarehouse | null>(null);
    // Inventory department name chosen for new warehouse
    const [newDeptName, setNewDeptName] = useState('');

    // name → inventory_dept UUID lookup
    const invDeptByName = useMemo(() => {
        const map: Record<string, { id: string; name: string }> = {};
        for (const d of invDepts) {
            map[d.name.toLowerCase()] = d;
        }
        return map;
    }, [invDepts]);

    const invDeptNames = useMemo(
        () => invDepts.map(dept => dept.name).sort((a, b) => a.localeCompare(b)),
        [invDepts]
    );

    const activeWarehouses = useMemo(
        () => warehouses.filter(warehouse => warehouse.status === 'active' && warehouse.is_active),
        [warehouses]
    );
    const mainWarehouse = activeWarehouses.find(warehouse => warehouse.is_main);

    const selectedDepartment = newDeptName
        ? invDeptByName[newDeptName.toLowerCase()]
        : undefined;
    const existingDepartmentWarehouse = selectedDepartment
        ? warehouses.find(warehouse =>
            warehouse.department_id === selectedDepartment.id ||
            warehouse.name.toLowerCase() === selectedDepartment.name.toLowerCase()
        )
        : undefined;

    // Resolve an inventory department name to its UUID.
    // Uses the parent-supplied invDepts list (always fresh after onUpdate).
    // Only creates a new inventory_dept if genuinely missing.
    const resolveInvDeptId = async (name: string): Promise<string | null> => {
        if (!name) return null;
        const existing = invDeptByName[name.toLowerCase()];
        if (existing) return existing.id;

        // Not found in parent's fresh list — safe to create
        const res = await fetch('/api/admin/inventory-departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const data = await safeJson(res);
        if (data.error) throw new Error(data.error);
        return data.department.id;
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            const department_id = newDeptName ? await resolveInvDeptId(newDeptName) : undefined;

            if (existingDepartmentWarehouse?.status === 'active' && existingDepartmentWarehouse.is_active) {
                throw new Error(`A store for "${newDeptName}" is already active.`);
            }

            const isReactivating = !!existingDepartmentWarehouse;
            const shouldActivate = !!department_id;
            const res = await fetch('/api/admin/inventory/warehouses', {
                method: isReactivating ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(isReactivating ? { id: existingDepartmentWarehouse.id } : {}),
                    name: newName.trim(),
                    description: newDescription.trim(),
                    department_id,
                    type: 'DEPARTMENT',
                    status: shouldActivate ? 'active' : 'inactive',
                    is_active: shouldActivate,
                }),
            });

            const data = await safeJson(res);
            if (data.error) throw new Error(data.error);

            toast({
                title: isReactivating ? "Store Reactivated" : "Store Created",
                description: isReactivating
                    ? `Successfully reactivated "${newName}".`
                    : shouldActivate
                        ? `Successfully added and activated "${newName}".`
                        : `Successfully saved "${newName}" as an inactive store.`,
            });
            setNewName('');
            setNewDescription('');
            setNewDeptName('');
            await onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to create store." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMainStoreChange = async (warehouse: InventoryWarehouse, checked: boolean) => {
        setUpdatingMainId(warehouse.id);
        try {
            const res = await fetch('/api/admin/inventory/warehouses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: warehouse.id, is_main: checked }),
            });
            const data = await safeJson(res);
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to update the main store.');

            await onUpdate();
            toast({
                title: checked ? 'Main Store Selected' : 'Main Store Unmarked',
                description: checked
                    ? `“${warehouse.name}” is now the Main Store.`
                    : `“${warehouse.name}” is no longer the Main Store.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to update the main store.',
            });
        } finally {
            setUpdatingMainId(null);
        }
    };

    return (
        <div className="space-y-6 pt-2">
            {/* Create form */}
            <form onSubmit={handleCreate} className="hidden space-y-4 p-6 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-2 mb-2">
                    <WarehouseIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Provision New Store</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="warehouse-name" className="text-xs font-semibold">Store Name</Label>
                        <Input
                            id="warehouse-name"
                            placeholder="e.g., Main Stores, Wine Cellar"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            readOnly={!!newDeptName}
                            className={newDeptName ? "bg-slate-100 cursor-not-allowed" : "bg-white/50"}
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="warehouse-desc" className="text-xs font-semibold">Location / Description</Label>
                        <Input
                            id="warehouse-desc"
                            placeholder="Briefly describe the physical location"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className="bg-white/50"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs font-semibold">
                            Link to Department <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Select
                            value={newDeptName || NONE}
                            onValueChange={(val) => {
                                const name = val === NONE ? '' : val;
                                setNewDeptName(name);
                                if (!name) {
                                    setNewName('');
                                    setNewDescription('');
                                    return;
                                }

                                const department = invDeptByName[name.toLowerCase()];
                                const existingWarehouse = warehouses.find(warehouse =>
                                    warehouse.department_id === department?.id ||
                                    warehouse.name.toLowerCase() === name.toLowerCase()
                                );
                                setNewName(existingWarehouse?.name || name);
                                setNewDescription(existingWarehouse?.description || '');
                            }}
                        >
                            <SelectTrigger className="bg-white/50">
                                <SelectValue placeholder="Select inventory department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>No department</SelectItem>
                                {invDeptNames.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {newDeptName && newName.trim() !== newDeptName && (
                    <p className="text-xs text-destructive font-medium">
                        Store Name must match the linked department name. Please set Store Name to &ldquo;{newDeptName}&rdquo;.
                    </p>
                )}
                {existingDepartmentWarehouse && !(existingDepartmentWarehouse.status === 'active' && existingDepartmentWarehouse.is_active) && (
                    <p className="text-xs text-amber-700 font-medium">
                        An inactive store already exists for this department. Its saved details were loaded and it will be reactivated.
                    </p>
                )}
                {existingDepartmentWarehouse?.status === 'active' && existingDepartmentWarehouse.is_active && (
                    <p className="text-xs text-destructive font-medium">
                        This department already has an active store.
                    </p>
                )}
                <Button
                    type="submit"
                    disabled={
                        isSubmitting ||
                        !newName.trim() ||
                        (!!newDeptName && newName.trim() !== newDeptName) ||
                        (existingDepartmentWarehouse?.status === 'active' && existingDepartmentWarehouse.is_active)
                    }
                    className="w-full h-11 font-bold"
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    {existingDepartmentWarehouse && !(existingDepartmentWarehouse.status === 'active' && existingDepartmentWarehouse.is_active)
                        ? 'Reactivate Warehouse Location'
                        : 'Initialize Warehouse Location'}
                </Button>
            </form>

            {/* Warehouse list */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Storage Units</h3>
                    <Badge variant="secondary" className="text-[10px]">{activeWarehouses.length} Total</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {activeWarehouses.length === 0 ? (
                        <div className="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground">
                            No active stores found.
                        </div>
                    ) : (
                        activeWarehouses.map((warehouse) => {
                            const savedName = warehouse.department?.name ?? '';

                            return (
                                <div key={warehouse.id} className="p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow space-y-3">
                                    {/* Top row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                                <WarehouseIcon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-800">{warehouse.name}</span>
                                                    {warehouse.is_main && (
                                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] h-4">Main Store</Badge>
                                                    )}
                                                    {savedName && (
                                                        <Badge variant="outline" className="text-[9px] h-4 text-primary border-primary/30 gap-1">
                                                            <Link2 className="h-2.5 w-2.5" />
                                                            {savedName}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {warehouse.description && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">{warehouse.description}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label
                                                className={`flex items-center gap-2 text-xs font-semibold ${
                                                    !warehouse.is_main && mainWarehouse
                                                        ? 'text-slate-400 cursor-not-allowed'
                                                        : 'text-slate-700 cursor-pointer'
                                                }`}
                                                title={!warehouse.is_main && mainWarehouse
                                                    ? `Unmark “${mainWarehouse.name}” before selecting another Main Store.`
                                                    : 'Mark this storage unit as the Main Store'
                                                }
                                            >
                                                {updatingMainId === warehouse.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Checkbox
                                                        checked={warehouse.is_main}
                                                        disabled={!!updatingMainId || (!warehouse.is_main && !!mainWarehouse)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked === true) {
                                                                handleMainStoreChange(warehouse, true);
                                                            } else {
                                                                setPendingMainRemoval(warehouse);
                                                            }
                                                        }}
                                                        aria-label={`Set ${warehouse.name} as Main Store`}
                                                    />
                                                )}
                                                Main Store
                                            </label>
                                            <div className="text-right hidden sm:block mr-2">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Status</div>
                                                <div className={`text-xs font-bold ${warehouse.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {warehouse.is_active ? 'Active' : 'Offline'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Department link row */}
                                    <div className="flex items-center gap-3 pt-1 border-t border-slate-50">
                                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide w-32 shrink-0">
                                            Linked Department
                                        </span>
                                        <div className="flex-1 h-8 px-3 flex items-center rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                                            {savedName || 'Not linked'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <AlertDialog
                open={!!pendingMainRemoval}
                onOpenChange={(open) => !open && setPendingMainRemoval(null)}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Main Store designation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingMainRemoval
                                ? `“${pendingMainRemoval.name}” will no longer be the Main Store. Some inventory operations require a Main Store, so select another one afterward.`
                                : 'This storage unit will no longer be the Main Store.'
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(event) => {
                                event.preventDefault();
                                if (!pendingMainRemoval) return;
                                const warehouse = pendingMainRemoval;
                                setPendingMainRemoval(null);
                                handleMainStoreChange(warehouse, false);
                            }}
                        >
                            Remove Main Store
                        </AlertDialogAction>
                        <AlertDialogCancel className="bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white">
                            Keep as Main Store
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
