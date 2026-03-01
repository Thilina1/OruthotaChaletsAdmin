'use client';

import { useState, useMemo } from 'react';
import { useSupabaseCollection } from '@/hooks/use-supabase-collection';
import { createClient } from '@/lib/supabase/client';
import type { User, UserRole } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Trash2, Save, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { UserForm } from '@/components/dashboard/user-management/user-form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const ROLES: UserRole[] = ['admin', 'waiter', 'kitchen', 'payment'];

export default function UserManagementPage() {
    const { toast } = useToast();
    const supabase = createClient();
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);

    const { data: users, loading: areUsersLoading, refetch } = useSupabaseCollection<User>('users');

    const [userRoles, setUserRoles] = useState<Record<string, UserRole>>({});
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const handleRoleChange = (userId: string, role: UserRole) => {
        setUserRoles(prev => ({ ...prev, [userId]: role }));
    };

    const handleSaveChanges = async (userId: string) => {
        const newRole = userRoles[userId];
        if (!newRole) {
            toast({ variant: 'destructive', title: 'No change', description: 'Please select a new role first.' });
            return;
        }

        try {
            const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);

            if (error) throw error;

            toast({ title: 'Role Updated', description: `User role has been successfully changed to ${newRole}.` });
            refetch();
        } catch (error) {
            console.error("Error updating user role:", error);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update the user role.' });
        }
    };

    const handleDeleteClick = (user: User) => {
        setUserToDelete({ id: user.id, name: user.name });
        setIsDeleteDialogOpen(true);
    };

    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setIsAddUserOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;

        try {
            const { error } = await supabase.from('users').delete().eq('id', userToDelete.id);

            if (error) throw error;

            toast({ title: 'User Deleted', description: `User "${userToDelete.name}" has been successfully deleted.` });
            refetch();
        } catch (error) {
            console.error("Error deleting user:", error);
            toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the user.' });
        } finally {
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        }
    };

    const handleFormSubmit = async (values: any) => {
        try {
            const url = editingUser ? `/api/admin/users?id=${editingUser.id}` : '/api/admin/users';
            const method = editingUser ? 'PUT' : 'POST';

            const payload = {
                ...values,
                id: editingUser ? editingUser.id : undefined,
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Failed to ${editingUser ? 'update' : 'create'} user`);
            }

            toast({ title: `User ${editingUser ? 'Updated' : 'Created'}`, description: `User ${values.name} has been successfully ${editingUser ? 'updated' : 'created'}.` });
            setIsAddUserOpen(false);
            setEditingUser(null);
            refetch();
        } catch (error: any) {
            console.error(`Error ${editingUser ? 'updating' : 'creating'} user:`, error);
            toast({ variant: 'destructive', title: editingUser ? 'Update Failed' : 'Creation Failed', description: error.message });
        }
    };

    const sortedUsers = useMemo(() => {
        if (!users) return [];
        return [...users].sort((a, b) => a.name.localeCompare(b.name));
    }, [users]);

    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(sortedUsers, 20);

    if (areUsersLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="w-1/4"><Skeleton className="h-6 w-full" /></div>
                                    <div className="w-1/4"><Skeleton className="h-6 w-full" /></div>
                                    <div className="w-1/4"><Skeleton className="h-10 w-full" /></div>
                                    <div className="w-1/6 flex gap-2"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-10 w-1/2" /></div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">User Management</h1>
                    <p className="text-muted-foreground">Manage user accounts and roles.</p>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={(open) => {
                    if (!open) setEditingUser(null);
                    setIsAddUserOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingUser(null); setIsAddUserOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                            <DialogDescription>
                                {editingUser ? 'Modify user details and role. Leave password blank to keep it unchanged.' : 'Create a new user account. They will need to login with these credentials.'}
                            </DialogDescription>
                        </DialogHeader>
                        <UserForm key={editingUser ? editingUser.id : 'new'} user={editingUser} onSubmit={handleFormSubmit} />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription>View and manage all registered users in the system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Current Role</TableHead>
                                <TableHead>Change Role</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell className="capitalize">{user.role}</TableCell>
                                    <TableCell>
                                        <Select onValueChange={(value: UserRole) => handleRoleChange(user.id, value)} defaultValue={user.role}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select a role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLES.map(role => (
                                                    <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="outline" onClick={() => handleEditClick(user)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </Button>
                                        <Button size="sm" onClick={() => handleSaveChanges(user.id)} disabled={!userRoles[user.id] || userRoles[user.id] === user.role}>
                                            <Save className="mr-2 h-4 w-4" /> Save
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(user)}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {!areUsersLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user "{userToDelete?.name}".
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
