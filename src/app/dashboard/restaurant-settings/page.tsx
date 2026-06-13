'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Edit2, Save, X, Warehouse } from 'lucide-react';
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
import type { RestaurantSection, InventoryWarehouse } from '@/lib/types';

export default function RestaurantSettingsPage() {
    const { toast } = useToast();
    const [sections, setSections] = useState<RestaurantSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSectionName, setNewSectionName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Restaurant warehouse setting
    const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
    const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
    const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
    const [isWarehouseLoading, setIsWarehouseLoading] = useState(true);

    const fetchSections = async () => {
        try {
            const res = await fetch('/api/admin/restaurant-sections');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSections(data.sections || []);
        } catch (error: any) {
            console.error('Error fetching sections:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load restaurant sections.' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWarehouseSettings = async () => {
        try {
            const [warehousesRes, settingRes] = await Promise.all([
                fetch('/api/admin/inventory/warehouses'),
                fetch('/api/admin/app-settings?key=restaurant_warehouse_ids'),
            ]);
            const warehousesData = await warehousesRes.json();
            const settingData = await settingRes.json();
            setWarehouses(warehousesData.warehouses || []);
            setSelectedWarehouseIds(settingData.value || []);
        } catch (error: any) {
            console.error('Error fetching warehouse settings:', error);
        } finally {
            setIsWarehouseLoading(false);
        }
    };

    useEffect(() => {
        fetchSections();
        fetchWarehouseSettings();
    }, []);

    const handleWarehouseToggle = (id: string) => {
        setSelectedWarehouseIds(prev =>
            prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
        );
    };

    const handleSaveWarehouseSettings = async () => {
        setIsSavingWarehouse(true);
        try {
            const res = await fetch('/api/admin/app-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'restaurant_warehouse_ids', value: selectedWarehouseIds }),
            });
            if (!res.ok) throw new Error('Failed to save');
            toast({ title: 'Success', description: 'Restaurant warehouse settings saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save settings.' });
        } finally {
            setIsSavingWarehouse(false);
        }
    };

    const handleAddSection = async () => {
        if (!newSectionName.trim()) return;
        setIsAdding(true);
        try {
            const res = await fetch('/api/admin/restaurant-sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSectionName.trim() }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setSections([...sections, data.section]);
            setNewSectionName('');
            toast({ title: 'Success', description: 'Section added successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to add section.' });
        } finally {
            setIsAdding(false);
        }
    };

    const handleUpdateSection = async (id: string) => {
        if (!editName.trim()) return;
        try {
            const res = await fetch('/api/admin/restaurant-sections', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name: editName.trim() }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setSections(sections.map(s => s.id === id ? data.section : s));
            setEditingId(null);
            setEditName('');
            toast({ title: 'Success', description: 'Section updated successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update section.' });
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`/api/admin/restaurant-sections?id=${deleteId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete');
            }

            setSections(sections.filter(s => s.id !== deleteId));
            toast({ title: 'Success', description: 'Section deleted successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete section.' });
        } finally {
            setIsDeleteDialogOpen(false);
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-headline font-bold">Restaurant Settings</h1>
                <p className="text-muted-foreground">Manage dynamic configurations for your restaurant.</p>
            </div>

            {/* Restaurant Warehouse Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Warehouse className="h-5 w-5 text-primary" />
                        Restaurant Warehouses
                    </CardTitle>
                    <CardDescription>
                        Select which inventory warehouses supply the restaurant. Items from these warehouses will be available to link to menu items.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isWarehouseLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : warehouses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active warehouses found. Create warehouses in Inventory &gt; Manage Store.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {warehouses.map(wh => (
                                <label
                                    key={wh.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                                >
                                    <Checkbox
                                        id={`wh-${wh.id}`}
                                        checked={selectedWarehouseIds.includes(wh.id)}
                                        onCheckedChange={() => handleWarehouseToggle(wh.id)}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{wh.name}</p>
                                        {wh.department && (
                                            <p className="text-xs text-muted-foreground">{wh.department.name}</p>
                                        )}
                                    </div>
                                    {selectedWarehouseIds.includes(wh.id) && (
                                        <Badge variant="secondary" className="text-xs shrink-0">Selected</Badge>
                                    )}
                                </label>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-muted-foreground">
                            {selectedWarehouseIds.length} warehouse{selectedWarehouseIds.length !== 1 ? 's' : ''} selected
                        </p>
                        <Button onClick={handleSaveWarehouseSettings} disabled={isSavingWarehouse}>
                            {isSavingWarehouse ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Restaurant Sections</CardTitle>
                    <CardDescription>Add or remove sections available for tables and menu items (e.g., "Poolside", "Rooftop").</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="flex gap-4 items-end">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="new-section">New Section Name</Label>
                            <Input
                                id="new-section"
                                placeholder="e.g. VIP Lounge"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                            />
                        </div>
                        <Button onClick={handleAddSection} disabled={isAdding || !newSectionName.trim()}>
                            {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Add Section
                        </Button>
                    </div>

                    <div className="border rounded-lg divide-y">
                        {isLoading ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : sections.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">No sections found. Add one above!</div>
                        ) : (
                            sections.map((section) => (
                                <div key={section.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                    {editingId === section.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="max-w-xs"
                                            />
                                            <Button size="icon" variant="ghost" onClick={() => handleUpdateSection(section.id)}><Save className="h-4 w-4 text-green-600" /></Button>
                                            <Button size="icon" variant="ghost" onClick={() => { setEditingId(null); setEditName(''); }}><X className="h-4 w-4 text-red-600" /></Button>
                                        </div>
                                    ) : (
                                        <span className="font-medium">{section.name}</span>
                                    )}

                                    <div className="flex items-center gap-2">
                                        {editingId !== section.id && (
                                            <Button size="icon" variant="outline" onClick={() => { setEditingId(section.id); setEditName(section.name); }}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button size="icon" variant="destructive" onClick={() => { setDeleteId(section.id); setIsDeleteDialogOpen(true); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </CardContent>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this section? This might affect existing tables or menu items using it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
