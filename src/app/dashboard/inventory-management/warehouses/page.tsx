'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { StoreManagement } from '@/components/dashboard/inventory-management/store-management';
import { Warehouse, ChevronRight, LayoutGrid, Plus, Trash2, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { InventoryWarehouse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InventoryDepartment {
    id: string;
    name: string;
    status: string;
}

export default function WarehouseManagementPage() {
    const { toast } = useToast();

    // Warehouses
    const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
    const [isLoadingWh, setIsLoadingWh] = useState(true);

    // Inventory departments
    const [invDepts, setInvDepts] = useState<InventoryDepartment[]>([]);
    const [isLoadingDepts, setIsLoadingDepts] = useState(true);
    const [newDeptName, setNewDeptName] = useState('');
    const [addingDept, setAddingDept] = useState(false);
    const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);
    const [activatingDeptId, setActivatingDeptId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchWarehouses = useCallback(async () => {
        setIsLoadingWh(true);
        try {
            const res = await fetch('/api/admin/inventory/warehouses?all=true');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setWarehouses(data.warehouses || []);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch warehouses." });
        } finally {
            setIsLoadingWh(false);
        }
    }, []);

    const fetchInvDepts = useCallback(async () => {
        setIsLoadingDepts(true);
        try {
            const res = await fetch('/api/admin/inventory-departments?all=true');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setInvDepts(data.departments || []);
        } catch {
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch departments." });
        } finally {
            setIsLoadingDepts(false);
        }
    }, []);

    useEffect(() => {
        fetchWarehouses();
        fetchInvDepts();
    }, [fetchWarehouses, fetchInvDepts]);

    const safeJson = async (res: Response) => {
        const text = await res.text();
        if (!text) return {};
        try { return JSON.parse(text); } catch { return {}; }
    };

    const handleAddDept = async () => {
        const name = newDeptName.trim();
        if (!name) return;
        setAddingDept(true);
        try {
            const res = await fetch('/api/admin/inventory-departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await safeJson(res);
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to create department.');
            setNewDeptName('');
            await fetchInvDepts();
            toast({ title: "Department Created", description: `"${name}" added to inventory departments.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to create department." });
        } finally {
            setAddingDept(false);
        }
    };

    const handleDeleteDept = async () => {
        if (!confirmDeleteId) return;
        setDeletingDeptId(confirmDeleteId);
        try {
            const res = await fetch(`/api/admin/inventory-departments?id=${confirmDeleteId}`, { method: 'DELETE' });
            const data = await safeJson(res);
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to remove department.');
            await fetchInvDepts();
            await fetchWarehouses();
            toast({
                title: "Department Removed",
                description: data.action === 'deleted'
                    ? "Unused department and its warehouse were permanently deleted."
                    : "Department is in use, so it and its warehouse were deactivated.",
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to remove department." });
        } finally {
            setDeletingDeptId(null);
            setConfirmDeleteId(null);
        }
    };

    const handleActivateDept = async (id: string) => {
        setActivatingDeptId(id);
        try {
            const res = await fetch('/api/admin/inventory-departments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'active' }),
            });
            const data = await safeJson(res);
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to reactivate department.');
            await Promise.all([fetchInvDepts(), fetchWarehouses()]);
            toast({
                title: "Department Reactivated",
                description: "The department and its linked warehouse are active again.",
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to reactivate department." });
        } finally {
            setActivatingDeptId(null);
        }
    };

    const handleUpdate = () => {
        fetchWarehouses();
        fetchInvDepts();
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/dashboard/inventory-management" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Inventory
                        </Link>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Stores</span>
                    </div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <Warehouse className="h-8 w-8 text-primary" />
                        Manage Store
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create and manage storage locations and inventory departments.
                    </p>
                </div>
            </div>

            {/* Inventory Departments section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold">Inventory Departments</h2>
                    <Badge variant="secondary" className="text-[10px]">{invDepts.length} total</Badge>
                </div>
                <p className="text-sm text-muted-foreground -mt-2">
                    Departments available in MRN Requests. Link each one to a Storage Unit below.
                </p>

                <div className="flex gap-3">
                    <Input
                        placeholder="New department name (e.g., Kitchen)"
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDept(); } }}
                        className="max-w-sm"
                    />
                    <Button onClick={handleAddDept} disabled={addingDept || !newDeptName.trim()}>
                        {addingDept ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Add Department
                    </Button>
                </div>

                {isLoadingDepts ? (
                    <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading departments…
                    </div>
                ) : invDepts.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                        No inventory departments yet. Add one above.
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {invDepts.map(dept => (
                            <div key={dept.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                                <span className="text-sm font-medium text-slate-700">{dept.name}</span>
                                {dept.status !== 'active' && (
                                    <Badge variant="outline" className="text-[9px] h-4 text-amber-600 border-amber-300">inactive</Badge>
                                )}
                                {dept.status !== 'active' && (
                                    <button
                                        onClick={() => handleActivateDept(dept.id)}
                                        disabled={activatingDeptId === dept.id}
                                        className="ml-0.5 rounded-full p-0.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                                        title="Reactivate department"
                                    >
                                        {activatingDeptId === dept.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <RotateCcw className="h-3 w-3" />
                                        }
                                    </button>
                                )}
                                <button
                                    onClick={() => setConfirmDeleteId(dept.id)}
                                    disabled={deletingDeptId === dept.id}
                                    className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                                    title="Remove department"
                                >
                                    {deletingDeptId === dept.id
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <Trash2 className="h-3 w-3" />
                                    }
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t pt-6">
                {isLoadingWh ? (
                    <div className="p-10 text-center border rounded-md">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                            <div className="h-8 w-8 bg-muted rounded-full" />
                            <div className="h-4 w-32 bg-muted rounded" />
                        </div>
                        <div className="mt-4 text-muted-foreground">Loading stores...</div>
                    </div>
                ) : (
                    <StoreManagement warehouses={warehouses} invDepts={invDepts} onUpdate={handleUpdate} />
                )}
            </div>

            <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Inventory Department?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Unused departments and their linked warehouses are permanently deleted. If inventory or transaction history uses this department, both records will be deactivated instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={e => { e.preventDefault(); handleDeleteDept(); }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
