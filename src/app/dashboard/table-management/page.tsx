'use client';

import { useState, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Table as TableType, TableSection, TableStatus, RestaurantSection } from '@/lib/types';

import { Skeleton } from '@/components/ui/skeleton';
import { TableForm } from '@/components/dashboard/table-management/table-form';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const statusColors: Record<string, string> = {
    'available': 'bg-green-100 text-green-800 hover:bg-green-100/80',
    'occupied': 'bg-red-100 text-red-800 hover:bg-red-100/80',
    'reserved': 'bg-orange-100 text-orange-800 hover:bg-orange-100/80',
    'cleaning': 'bg-blue-100 text-blue-800 hover:bg-blue-100/80',
};

export default function TableManagementPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const { user: currentUser } = useUserContext();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<TableType | null>(null);
    const [tables, setTables] = useState<TableType[]>([]);
    const [sections, setSections] = useState<RestaurantSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [tablesRes, sectionsRes] = await Promise.all([
                supabase.from('restaurant_tables').select('*').order('table_number'),
                fetch('/api/admin/restaurant-sections').then(res => res.json())
            ]);

            if (tablesRes.error) throw tablesRes.error;
            setTables(tablesRes.data as TableType[]);

            if (sectionsRes.error) throw new Error(sectionsRes.error);
            setSections(sectionsRes.sections || []);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch data." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchData();
        }

        const channel = supabase.channel('table-management')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
                // Ideally refresh tables only
                supabase.from('restaurant_tables').select('*').order('table_number')
                    .then(({ data }) => { if (data) setTables(data as TableType[]) });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser]);

    const handleAddTableClick = () => {
        setEditingTable(null);
        setIsDialogOpen(true);
    };

    const handleEditTableClick = (table: TableType) => {
        setEditingTable(table);
        setIsDialogOpen(true);
    };

    const handleDeleteTable = async (id: string) => {
        if (confirm('Are you sure you want to delete this table? This cannot be undone.')) {
            try {
                const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
                if (error) throw error;
                toast({
                    title: 'Table Deleted',
                    description: 'The table has been successfully removed.',
                });
                // Optimistic update handled by realtime or fetch
            } catch (error) {
                console.error("Error deleting table: ", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to delete table.",
                });
            }
        }
    };

    const handleFormSubmit = async (values: any) => {
        if (!currentUser) return;

        // Map form values to DB values
        // Form likely provides camelCase: tableNumber, capacity, status, section
        const dataToSave = {
            table_number: values.tableNumber,
            capacity: values.capacity,
            status: values.status,
            location: values.section, // Map section to location
            // DB columns: table_number, capacity, status, location
        };

        try {
            if (editingTable) {
                const { data, error } = await supabase.from('restaurant_tables').update({
                    ...dataToSave,
                }).eq('id', editingTable.id).select().single();

                if (error) throw error;

                // Update local state immediately
                setTables(prevTables => prevTables.map(t => t.id === (data as TableType).id ? (data as TableType) : t));

                toast({ title: "Table Updated", description: "The table details have been updated." });

            } else {
                const { data, error } = await supabase.from('restaurant_tables').insert([{
                    ...dataToSave,
                }]).select().single();

                if (error) throw error;

                // Update local state immediately
                setTables(prevTables => [...prevTables, (data as TableType)].sort((a, b) => a.table_number - b.table_number));

                toast({ title: "Table Created", description: "A new table has been successfully added." });
            }
        } catch (error) {
            console.error("Error saving table: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save table." });
        }

        setIsDialogOpen(false);
        setEditingTable(null);
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

    const renderTableForSection = (section: string) => {
        // Map location to section
        const filteredItems = tables.filter(item => (item.location || 'Sri Lankan') === section);
        return <PaginatedTableSection items={filteredItems} onEdit={handleEditTableClick} onDelete={handleDeleteTable} />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Table Management</h1>
                    <p className="text-muted-foreground">Manage all tables in the restaurant.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) setEditingTable(null);
                    setIsDialogOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddTableClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Table
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingTable ? 'Edit Table' : 'Add New Table'}</DialogTitle>
                        </DialogHeader>
                        <TableForm
                            table={editingTable}
                            onSubmit={handleFormSubmit}
                            sections={sections}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tables</CardTitle>
                    <CardDescription>A list of all tables in your restaurant, organized by section.</CardDescription>
                </CardHeader>
                <CardContent>
                    {sections.length > 0 ? (
                        <Tabs defaultValue={sections[0].name}>
                            <TabsList className="grid w-full h-auto flex-wrap grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {sections.map(section => (
                                    <TabsTrigger key={section.id} value={section.name}>{section.name}</TabsTrigger>
                                ))}
                            </TabsList>
                            {sections.map(section => (
                                <TabsContent key={section.id} value={section.name}>
                                    <Card>
                                        <CardContent className="p-0">
                                            {renderTableForSection(section.name)}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            ))}
                        </Tabs>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            No sections found. Please add sections in Settings.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function PaginatedTableSection({ items, onEdit, onDelete }: { items: TableType[], onEdit: (t: TableType) => void, onDelete: (id: string) => void }) {
    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(items, 20);

    return (
        <div className="flex flex-col">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Table No.</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.table_number}</TableCell>
                            <TableCell>{item.capacity}</TableCell>
                            <TableCell>
                                <Badge variant="secondary" className={`capitalize ${statusColors[item.status]}`}>
                                    {item.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(item)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => onDelete(item.id)}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!paginatedItems || paginatedItems.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                No tables found in this section.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />
        </div>
    );
}
