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
import { MoreHorizontal, UserPlus, Trash2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { User, UserRole } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const roleColors: Record<UserRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  waiter: 'bg-accent text-accent-foreground',
  payment: 'bg-emerald-500 text-white',
  kitchen: 'bg-orange-500 text-white',
};

export default function UserManagementPage() {
  const supabase = createClient();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error("Error fetching users:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch users." });
    } else {
      setUsers(data as User[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase.channel('user-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddUser = () => alert("Add user dialog would open here.");
  const handleEditUser = (id: string) => alert(`Edit user dialog for user ${id} would open here.`);

  const handleDeleteUser = async (id: string) => {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        toast({ title: "User deleted", description: "User has been removed from the system." });
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (error) {
        console.error("Error deleting user: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete user." });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage all staff members in one place.</p>
        </div>
        <Button onClick={handleAddUser} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Card className="glassy rounded-2xl">
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <CardDescription>A list of all users in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/20">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <>
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={i} className="border-white/10">
                      <TableCell colSpan={4}><Skeleton className="h-8 w-full bg-white/10" /></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {!isLoading && users && users.map((user) => (
                <TableRow key={user.id} className="border-white/10">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`capitalize ${roleColors[user.role] || 'bg-gray-500'}`}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glassy">
                        <DropdownMenuItem onClick={() => handleEditUser(user.id)} className="hover:bg-white/10">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500 hover:!text-red-500 hover:!bg-red-500/10" onClick={() => handleDeleteUser(user.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
