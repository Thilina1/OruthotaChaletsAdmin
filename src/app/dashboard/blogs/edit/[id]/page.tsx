'use client';

import { useState, useEffect } from 'react';
import { BlogForm } from '@/components/dashboard/blogs/blog-form';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Blog } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditBlogPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const router = useRouter();
    const { id } = useParams() as { id: string };

    const [blog, setBlog] = useState<Blog | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBlog = async () => {
            const { data, error } = await supabase.from('blogs').select('*').eq('id', id).single();
            if (error) {
                console.error("Error fetching blog:", error);
                toast({ variant: 'destructive', title: "Error", description: "Failed to fetch blog post." });
            } else {
                setBlog(data as Blog);
            }
            setIsLoading(false);
        }

        fetchBlog();
    }, [id, supabase, toast]);

    const handleUpdateBlog = async (values: any) => {
        if (!blog) return;

        try {
            const dataToUpdate: Partial<Blog> & { id: string } = {
                id: blog.id,
                title: values.title,
                preview_header: values.previewHeader,
                preview_description: values.previewDescription,
                header_1: values.header1,
                content_1: values.content1,
                content_2: values.content2,
                content_image: values.contentImage,
                featured: values.featured,
                color: values.color,
                tags: values.tags?.map((t: any) => t.value) || [],
                pro_tips: values.proTips,
                booking_button_text: values.bookingButtonText,
                booking_button_content: values.bookingButtonContent,
                updated_at: new Date().toISOString(),
            };

            // Use the secure admin API to update the blog post
            const res = await fetch('/api/admin/blogs', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToUpdate),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to update blog post via API');
            }

            toast({
                title: 'Blog Post Updated',
                description: 'Your blog post has been successfully updated.',
            });
            router.push('/dashboard/blogs');

        } catch (error: any) {
            console.error('Error updating blog post: ', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `An error occurred while updating the blog post. ${error.message || ''}`,
            });
        }
    };

    if (isLoading || !blog) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Edit Blog Post</h1>
                    <p className="text-muted-foreground">Update the details for your post.</p>
                </div>
            </div>
            <BlogForm blog={blog} onSubmit={handleUpdateBlog} />
        </div>
    );
}
