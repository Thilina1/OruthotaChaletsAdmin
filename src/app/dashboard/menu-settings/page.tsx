'use client';

import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { MenuSection } from "@/lib/types";

export default function MenuSettingsPage() {
    const { toast } = useToast();
    const [sections, setSections] = useState<MenuSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
    const [sectionName, setSectionName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const fetchSections = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/menu-sections');
            const data = await response.json();
            if (response.ok) {
                setSections(data.sections || []);
            } else {
                toast({ variant: "destructive", title: "Error", description: data.error || "Failed to fetch sections" });
            }
        } catch (error) {
            console.error("Error fetching sections:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch sections" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSections();
    }, []);

    const handleOpenDialog = (section?: MenuSection) => {
        if (section) {
            setEditingSection(section);
            setSectionName(section.name);
        } else {
            setEditingSection(null);
            setSectionName("");
        }
        setIsDialogOpen(true);
    };

    const handleSaveSection = async () => {
        if (!sectionName.trim()) return;

        setIsSaving(true);
        try {
            const method = editingSection ? 'PUT' : 'POST';
            const body = editingSection ? { id: editingSection.id, name: sectionName } : { name: sectionName };

            const response = await fetch('/api/admin/menu-sections', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (response.ok) {
                toast({ title: "Success", description: `Section ${editingSection ? 'updated' : 'created'} successfully` });
                setIsDialogOpen(false);
                fetchSections();
            } else {
                toast({ variant: "destructive", title: "Error", description: data.error || "Failed to save section" });
            }
        } catch (error) {
            console.error("Error saving section:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save section" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSection = async (id: string) => {
        try {
            const response = await fetch(`/api/admin/menu-sections?id=${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();

            if (response.ok) {
                toast({ title: "Success", description: "Section deleted successfully" });
                fetchSections();
            } else {
                toast({ variant: "destructive", title: "Error", description: data.error || "Failed to delete section" });
            }
        } catch (error) {
            console.error("Error deleting section:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete section" });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Menu Settings</h1>
                <p className="text-muted-foreground">Manage menu categories/sections (e.g., Sri Lankan, Western, Desserts).</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Menu Sections</CardTitle>
                        <CardDescription>Add or remove sections used for categorizing menu items.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add Section
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sections.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                            No sections found. Add one to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sections.map((section) => (
                                        <TableRow key={section.id}>
                                            <TableCell className="font-medium">{section.name}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(section)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete the section.
                                                                    Ensure no menu items are using this section before deleting.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteSection(section.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSection ? 'Edit Section' : 'Add New Section'}</DialogTitle>
                        <DialogDescription>
                            Enter the name of the menu section.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={sectionName}
                                onChange={(e) => setSectionName(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. Desserts"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" onClick={handleSaveSection} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
