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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Activity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityForm } from '@/components/dashboard/activities/activity-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
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

const ITEMS_PER_PAGE = 20;

export default function ActivityManagementPage() {
  const supabase = createClient();
  const { toast } = useToast();
  const { user: currentUser } = useUserContext();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

  const fetchActivities = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching activities:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch activities." });
    } else {
      setActivities(data as Activity[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (currentUser) {
      fetchActivities();
    }

    const channel = supabase.channel('activities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
        fetchActivities();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const totalPages = activities ? Math.ceil(activities.length / ITEMS_PER_PAGE) : 0;
  const paginatedActivities = activities?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddActivityClick = () => {
    setEditingActivity(null);
    setIsDialogOpen(true);
  };

  const handleEditActivityClick = (activity: Activity) => {
    setEditingActivity(activity);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (activity: Activity) => {
    setActivityToDelete(activity);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!activityToDelete) return;

    try {
      const { error } = await supabase.from('activities').delete().eq('id', activityToDelete.id);
      if (error) throw error;

      setActivities(prev => prev.filter(a => a.id !== activityToDelete.id));

      toast({
        title: 'Activity Deleted',
        description: 'The activity has been successfully removed.',
      });
    } catch (error) {
      console.error("Error deleting activity: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete activity.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setActivityToDelete(null);
    }
  };

  const handleFormSubmit = async (values: any) => {
    if (!currentUser) return;

    // Map form values to DB
    const dataToSave = {
      name: values.name,
      description: values.description,
      type: values.type,
      price_per_person: values.type === 'priceable' ? values.pricePerPerson : null,
    };

    try {
      if (editingActivity) {
        const { error, data } = await supabase.from('activities').update({
          ...dataToSave,
          updated_at: new Date().toISOString(),
        }).eq('id', editingActivity.id).select().single();

        if (error) throw error;

        setActivities(prev => prev.map(a => a.id === editingActivity.id ? (data as Activity) : a));
        toast({ title: "Activity Updated", description: "The activity details have been updated." });

      } else {
        const { error, data } = await supabase.from('activities').insert([{
          ...dataToSave,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]).select().single();

        if (error) throw error;

        setActivities(prev => [(data as Activity), ...prev]);
        toast({ title: "Activity Created", description: "A new activity has been successfully added." });
      }
    } catch (error) {
      console.error("Error saving activity: ", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save activity." });
    }

    setIsDialogOpen(false);
    setEditingActivity(null);
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
          <h1 className="text-3xl font-headline font-bold">Activity Management</h1>
          <p className="text-muted-foreground">Manage all activities offered.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) setEditingActivity(null);
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleAddActivityClick}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingActivity ? 'Edit Activity' : 'Add New Activity'}</DialogTitle>
            </DialogHeader>
            <ActivityForm
              activity={editingActivity}
              onSubmit={handleFormSubmit}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activities</CardTitle>
          <CardDescription>A list of all available activities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price/Person (LKR)</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedActivities && paginatedActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="font-medium">{activity.name}</TableCell>
                  <TableCell>
                    <Badge variant={activity.type === 'priceable' ? 'default' : 'secondary'} className="capitalize">{activity.type}</Badge>
                  </TableCell>
                  <TableCell>
                    {activity.type === 'priceable' && activity.price_per_person
                      ? activity.price_per_person.toFixed(2)
                      : 'N/A'}
                  </TableCell>
                  <TableCell>{activity.updated_at ? new Date(activity.updated_at).toLocaleString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditActivityClick(activity)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => handleDeleteClick(activity)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!paginatedActivities || paginatedActivities.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No activities found. Add an activity to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="p-2 text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the activity "{activityToDelete?.name}".
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
