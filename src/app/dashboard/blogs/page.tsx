'use client';

import { useState, useEffect, forwardRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, GripVertical } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import type { Blog } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
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

export default function BlogManagementPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [featuredBlogs, setFeaturedBlogs] = useState<Blog[]>([]);
  const [nonFeaturedBlogs, setNonFeaturedBlogs] = useState<Blog[]>([]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteIsFeatured, setDeleteIsFeatured] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchBlogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching blogs:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch blogs." });
    } else {
      setBlogs(data as Blog[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  useEffect(() => {
    if (blogs) {
      const featured = blogs
        .filter(b => b.featured)
        .sort((a, b) => (a.featured_position || 0) - (b.featured_position || 0));
      const nonFeatured = blogs.filter(b => !b.featured);
      setFeaturedBlogs(featured);
      setNonFeaturedBlogs(nonFeatured);
    }
  }, [blogs]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = featuredBlogs.findIndex(b => b.id === active.id);
      const newIndex = featuredBlogs.findIndex(b => b.id === over?.id);

      const newOrder = arrayMove(featuredBlogs, oldIndex, newIndex);
      setFeaturedBlogs(newOrder);

      try {
        // Update positions in DB via API
        await Promise.all(newOrder.map((blog, index) =>
          fetch('/api/admin/blogs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: blog.id, featured_position: index + 1 })
          }).then(res => { if (!res.ok) throw new Error('Failed to update') })
        ));

        toast({
          title: 'Reordering Successful',
          description: 'Featured blogs have been reordered.',
        });

        // Refresh to sync local fully
        fetchBlogs();

      } catch (error) {
        console.error("Error reordering blogs: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to reorder blogs.",
        });
        fetchBlogs(); // Revert
      }
    }
  };

  const handleDeleteClick = (blogId: string, isFeatured: boolean) => {
    setDeleteId(blogId);
    setDeleteIsFeatured(isFeatured);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/admin/blogs?id=${deleteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast({
        title: 'Blog Post Deleted',
        description: 'The blog post has been successfully removed.',
      });

      // Optimistic update
      setBlogs(prev => prev.filter(b => b.id !== deleteId));

    } catch (error) {
      console.error("Error deleting blog: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete blog post.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteId(null);
    }
  };

  const renderBlogList = (blogList: Blog[], isFeatured: boolean) => {
    if (isLoading) {
      return <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>;
    }

    if (blogList.length === 0) {
      return <p className="text-center text-muted-foreground py-6">No {isFeatured ? 'featured' : ''} blog posts found.</p>;
    }

    if (isFeatured) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        >
          <SortableContext items={blogList} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blogList.map((blog) => (
                <SortableBlogListItem key={blog.id} blog={blog} onDelete={() => handleDeleteClick(blog.id, true)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      );
    }

    return (
      <div className="space-y-3">
        {blogList.map(blog => (
          <BlogListItem key={blog.id} blog={blog} onDelete={() => handleDeleteClick(blog.id, false)} isSortable={false} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-bold">Blog Management</h1>
          <p className="text-muted-foreground">Create, edit, and manage all your blog posts.</p>
        </div>
        <Link href="/dashboard/blogs/create">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Blog Post
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Featured Blogs</CardTitle>
            <CardDescription>Drag and drop to reorder featured posts.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderBlogList(featuredBlogs, true)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Other Blogs</CardTitle>
            <CardDescription>All non-featured blog posts.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderBlogList(nonFeaturedBlogs, false)}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the blog post.
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

interface BlogListItemProps {
  blog: Blog;
  onDelete: () => void;
  isSortable?: boolean;
}

const BlogListItem = forwardRef<HTMLDivElement, BlogListItemProps & React.HTMLAttributes<HTMLDivElement>>(({ blog, onDelete, isSortable = false, ...props }, ref) => (
  <div ref={ref} {...props} className="flex items-center gap-4 p-2 rounded-lg border bg-card hover:bg-muted transition-colors">
    {isSortable && <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />}
    <Image
      src={blog.content_image || 'https://placehold.co/100x100'}
      alt={blog.title}
      width={64}
      height={64}
      className="rounded-md object-cover w-16 h-16"
    />
    <div className="flex-1">
      <p className="font-semibold">{blog.title}</p>
      <p className="text-sm text-muted-foreground">{blog.preview_header}</p>
    </div>
    <div className="flex items-center gap-2">
      <Link href={`/dashboard/blogs/edit/${blog.id}`}>
        <Button variant="outline" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </Link>
      <Button variant="destructive" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
));
BlogListItem.displayName = 'BlogListItem';

const SortableBlogListItem = ({ blog, onDelete }: Omit<BlogListItemProps, 'isSortable'>) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: blog.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <BlogListItem
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      blog={blog}
      onDelete={onDelete}
      isSortable={true}
    />
  );
};
