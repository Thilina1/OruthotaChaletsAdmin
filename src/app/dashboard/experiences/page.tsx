'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from 'lucide-react';
import type { Experience } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ExperienceForm } from '@/components/dashboard/experiences/experience-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const ITEMS_PER_PAGE = 20;

export default function ExperienceManagementPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const { user: currentUser } = useUserContext();

    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExperience, setEditingExperience] = useState<Experience | null>(null);

    const fetchExperiences = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error("Error fetching experiences:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch experiences." });
        } else {
            setExperiences(data as Experience[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (currentUser) {
            fetchExperiences();
        }

        const channel = supabase.channel('experiences')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'experiences' }, () => {
                fetchExperiences();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser]);

    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems: paginatedExperiences,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(experiences || [], 20);

    const handleAddExperienceClick = () => {
        setEditingExperience(null);
        setIsDialogOpen(true);
    };

    const handleEditExperienceClick = (experience: Experience) => {
        setEditingExperience(experience);
        setIsDialogOpen(true);
    };

    const handleDeleteExperience = async (id: string) => {
        if (confirm('Are you sure you want to delete this experience? This cannot be undone.')) {
            try {
                const { error } = await supabase.from('experiences').delete().eq('id', id);
                if (error) throw error;
                toast({
                    title: 'Experience Deleted',
                    description: 'The experience has been successfully removed.',
                });
            } catch (error) {
                console.error("Error deleting experience: ", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to delete experience.",
                });
            }
        }
    };

    const handleFormSubmit = async (values: any) => {
        if (!currentUser) return;

        const dataToSave = {
            title: values.title,
            description: values.description,
            image_url: values.imageUrl, // Map form imageUrl to DB image_url
        };

        try {
            if (editingExperience) {
                const { error } = await supabase.from('experiences').update({
                    ...dataToSave,
                    updated_at: new Date().toISOString(),
                }).eq('id', editingExperience.id);

                if (error) throw error;
                toast({ title: "Experience Updated", description: "The experience details have been updated." });

            } else {
                const { error } = await supabase.from('experiences').insert([{
                    ...dataToSave,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }]);
                if (error) throw error;
                toast({ title: "Experience Created", description: "A new experience has been successfully added." });
            }
        } catch (error) {
            console.error("Error saving experience: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save experience." });
        }

        setIsDialogOpen(false);
        setEditingExperience(null);
    };

    if (!currentUser || isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <Skeleton className="h-12 w-1/2" />
                    <Skeleton className="h-10 w-28" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Experience Management</h1>
                    <p className="text-muted-foreground">Manage all special experiences offered.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) setEditingExperience(null);
                    setIsDialogOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddExperienceClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Experience
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingExperience ? 'Edit Experience' : 'Add New Experience'}</DialogTitle>
                        </DialogHeader>
                        <ExperienceForm
                            experience={editingExperience}
                            onSubmit={handleFormSubmit}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Experiences</CardTitle>
                    <CardDescription>A list of all available experiences.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Image</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Last Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedExperiences && paginatedExperiences.map((experience) => (
                                <TableRow key={experience.id}>
                                    <TableCell>
                                        <Image
                                            src={experience.image_url || 'https://placehold.co/100x60'}
                                            alt={experience.title}
                                            width={100}
                                            height={60}
                                            className="rounded-md object-cover w-24 h-16"
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{experience.title}</TableCell>
                                    <TableCell className="max-w-xs truncate">{experience.description}</TableCell>
                                    <TableCell>{experience.updated_at ? new Date(experience.updated_at).toLocaleString() : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditExperienceClick(experience)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => handleDeleteExperience(experience.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!paginatedExperiences || paginatedExperiences.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                        No experiences found. Add one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                {!isLoading && (
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </Card>
        </div>
    );
}
