'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { InventoryDepartment } from '@/lib/types';
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

interface StoreManagementProps {
    warehouses: InventoryDepartment[];
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
            const res = await fetch('/api/admin/inventory-departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDescription.trim(),
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
            const res = await fetch(`/api/admin/inventory-departments?id=${deleteId}`, {
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
            <form onSubmit={handleCreate} className="space-y-4 p-4 rounded-lg border bg-muted/20">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add New Store</h3>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="warehouse-name">Name</Label>
                        <Input
                            id="warehouse-name"
                            placeholder="e.g., Main Stores, Wine Cellar"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="warehouse-desc">Description (Optional)</Label>
                        <Input
                            id="warehouse-desc"
                            placeholder="Short description or location"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                        />
                    </div>
                    <Button type="submit" disabled={isSubmitting || !newName.trim()} className="w-full">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Create Store
                    </Button>
                </div>
            </form>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Existing Stores</h3>
                <div className="divide-y rounded-md border">
                    {warehouses.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No stores found.</div>
                    ) : (
                        warehouses.map((warehouse) => {
                            const itemCount = warehouse.items_count?.[0]?.count || 0;
                            const canDelete = itemCount === 0;

                            return (
                                <div key={warehouse.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{warehouse.name}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${itemCount > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                        {warehouse.description && (
                                            <div className="text-xs text-muted-foreground">{warehouse.description}</div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`${canDelete ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground cursor-not-allowed opacity-50'}`}
                                        onClick={() => canDelete && setDeleteId(warehouse.id)}
                                        title={canDelete ? "Deactivate Store" : "Cannot delete store with items"}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && !isDeleting && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will deactivate the store. It can only be deactivated if there are no inventory items associated with it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
