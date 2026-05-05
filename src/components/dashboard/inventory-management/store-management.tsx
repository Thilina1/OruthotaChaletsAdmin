'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Warehouse as WarehouseIcon } from 'lucide-react';
import type { InventoryWarehouse } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';

interface StoreManagementProps {
    warehouses: InventoryWarehouse[];
    onUpdate: () => void;
}

export function StoreManagement({ warehouses, onUpdate }: StoreManagementProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/inventory/warehouses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDescription.trim(),
                    type: 'DEPARTMENT',
                    is_active: true,
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Store Created",
                description: `Successfully added "${newName}" to your stores.`,
            });

            setNewName('');
            setNewDescription('');
            onUpdate();
        } catch (error: any) {
            console.error("Error creating store:", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: error.message || "Failed to create store.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/admin/inventory/warehouses?id=${deleteId}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Store Deactivated",
                description: "The store has been successfully deactivated.",
            });
            onUpdate();
        } catch (error: any) {
            console.error("Error deleting store:", error);
            toast({
                variant: 'destructive',
                title: "Cannot Delete Store",
                description: error.message || "Failed to deactivate store.",
            });
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-6 pt-2">
            <form onSubmit={handleCreate} className="space-y-4 p-6 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-2 mb-2">
                    <WarehouseIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Provision New Store</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                <Button type="submit" disabled={isSubmitting || !newName.trim()} className="w-full h-11 font-bold">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Initialize Warehouse Location
                </Button>
            </form>

            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Storage Units</h3>
                    <Badge variant="secondary" className="text-[10px]">{warehouses.length} Total</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {warehouses.length === 0 ? (
                        <div className="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground">No active stores found.</div>
                    ) : (
                        warehouses.map((warehouse) => {
                            // In the new schema, total_stock or items might be counted differently.
                            // For now we'll assume the API provides a basic count if available.
                            const isActive = warehouse.is_active;

                            return (
                                <div key={warehouse.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <WarehouseIcon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800">{warehouse.name}</span>
                                                {warehouse.is_main && (
                                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] h-4">Main Store</Badge>
                                                )}
                                            </div>
                                            {warehouse.description && (
                                                <div className="text-xs text-muted-foreground mt-0.5">{warehouse.description}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right hidden sm:block mr-4">
                                            <div className="text-[10px] font-bold text-muted-foreground uppercase">Status</div>
                                            <div className={`text-xs font-bold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {isActive ? 'Active' : 'Offline'}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                                            onClick={() => setDeleteId(warehouse.id)}
                                            disabled={warehouse.is_main} // Cannot delete main store easily
                                            title={warehouse.is_main ? "Cannot delete main store" : "Deactivate Store"}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && !isDeleting && setDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Warehouse?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the storage location as inactive. You can only do this if there are no pending transactions for this location.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancel Operation</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm Deactivation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
