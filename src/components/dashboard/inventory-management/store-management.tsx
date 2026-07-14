'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Warehouse as WarehouseIcon, Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { InventoryWarehouse } from '@/lib/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

interface StoreManagementProps {
    warehouses: InventoryWarehouse[];
    invDepts: { id: string; name: string }[];
    onUpdate: () => void;
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
    // HR department name chosen for new warehouse
    const [newDeptName, setNewDeptName] = useState('');

    // HR department names from job_titles (same source as User Management)
    const [hrDepts, setHrDepts] = useState<string[]>([]);

    // Per-warehouse: selected HR dept name
    const [linkingName, setLinkingName] = useState<Record<string, string>>({});
    const [savingLink, setSavingLink] = useState<string | null>(null);

    // Fetch only HR departments on mount — invDepts comes from the parent (always fresh)
    useEffect(() => {
        fetch('/api/admin/job-titles').then(r => r.json()).then(jobData => {
            const names: string[] = Object.keys(jobData.titles || {}).sort();
            setHrDepts(names);
        }).catch(() => {});
    }, []);

    // Initialise linkingName from current warehouse.department?.name
    useEffect(() => {
        const initial: Record<string, string> = {};
        for (const wh of warehouses) {
            initial[wh.id] = wh.department?.name || '';
        }
        setLinkingName(initial);
    }, [warehouses]);

    // name → inventory_dept UUID lookup
    const invDeptByName = useMemo(() => {
        const map: Record<string, { id: string; name: string }> = {};
        for (const d of invDepts) {
            map[d.name.toLowerCase()] = d;
        }
        return map;
    }, [invDepts]);

    // Resolve an HR dept name to an inventory_departments UUID.
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

            const res = await fetch('/api/admin/inventory/warehouses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDescription.trim(),
                    department_id,
                    type: 'DEPARTMENT',
                    is_active: true,
                }),
            });

            const data = await safeJson(res);
            if (data.error) throw new Error(data.error);

            toast({ title: "Store Created", description: `Successfully added "${newName}" to your stores.` });
            setNewName('');
            setNewDescription('');
            setNewDeptName('');
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to create store." });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleLinkDepartment = async (warehouseId: string) => {
        setSavingLink(warehouseId);
        try {
            const selectedName = linkingName[warehouseId] || '';
            const department_id = selectedName ? await resolveInvDeptId(selectedName) : null;

            // If another warehouse already holds this department_id, clear it first
            // (unique constraint on inventory_warehouses.department_id)
            if (department_id) {
                const conflict = warehouses.find(wh => wh.id !== warehouseId && wh.department_id === department_id);
                if (conflict) {
                    await fetch('/api/admin/inventory/warehouses', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: conflict.id, department_id: null }),
                    });
                }
            }

            const res = await fetch('/api/admin/inventory/warehouses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: warehouseId, department_id }),
            });
            const data = await safeJson(res);
            if (data.error) throw new Error(data.error);

            toast({
                title: "Department Linked",
                description: selectedName
                    ? `Storage unit linked to "${selectedName}".`
                    : "Department link cleared.",
            });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to save link." });
        } finally {
            setSavingLink(null);
        }
    };

    return (
        <div className="space-y-6 pt-2">
            {/* Create form */}
            <form onSubmit={handleCreate} className="space-y-4 p-6 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent">
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
                            className="bg-white/50"
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
                                if (name) setNewName(name);
                            }}
                        >
                            <SelectTrigger className="bg-white/50">
                                <SelectValue placeholder="Select HR department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>No department</SelectItem>
                                {hrDepts.map(name => (
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
                <Button type="submit" disabled={isSubmitting || !newName.trim() || (!!newDeptName && newName.trim() !== newDeptName)} className="w-full h-11 font-bold">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Initialize Warehouse Location
                </Button>
            </form>

            {/* Warehouse list */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Storage Units</h3>
                    <Badge variant="secondary" className="text-[10px]">{warehouses.length} Total</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {warehouses.length === 0 ? (
                        <div className="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground">
                            No active stores found.
                        </div>
                    ) : (
                        warehouses.map((warehouse) => {
                            const currentName = linkingName[warehouse.id] ?? warehouse.department?.name ?? '';
                            const savedName = warehouse.department?.name ?? '';
                            const isDirty = currentName !== savedName;

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
                                                    {savedName && !isDirty && (
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
                                        <div className="flex-1 flex items-center gap-2">
                                            <Select
                                                value={currentName || NONE}
                                                onValueChange={(val) =>
                                                    setLinkingName(prev => ({ ...prev, [warehouse.id]: val === NONE ? '' : val }))
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-xs font-medium bg-slate-50 border-slate-200 flex-1">
                                                    <SelectValue placeholder="Not linked to any department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>Not linked</SelectItem>
                                                    {hrDepts.map(name => (
                                                        <SelectItem key={name} value={name} className="text-xs">
                                                            {name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                size="sm"
                                                variant={isDirty ? 'default' : 'outline'}
                                                className="h-8 text-xs font-bold px-3 shrink-0"
                                                onClick={() => handleLinkDepartment(warehouse.id)}
                                                disabled={savingLink === warehouse.id || !isDirty}
                                            >
                                                {savingLink === warehouse.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : isDirty ? (
                                                    <><CheckCircle2 className="h-3 w-3 mr-1" />Save</>
                                                ) : (
                                                    <><AlertCircle className="h-3 w-3 mr-1 text-muted-foreground" />Saved</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

        </div>
    );
}
