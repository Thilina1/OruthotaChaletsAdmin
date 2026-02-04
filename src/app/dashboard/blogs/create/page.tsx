'use client';

import { BlogForm } from '@/components/dashboard/blogs/blog-form';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Blog } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useUserContext } from '@/context/user-context';

export default function CreateBlogPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const router = useRouter();
    const { user } = useUserContext();

    const handleCreateBlog = async (values: any) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create blog post. User not authenticated.' });
            return;
        }

        try {
            const dataToSave: Partial<Blog> = {
                title: values.title,
                preview_header: values.previewHeader,
                preview_description: values.previewDescription,
                header_1: values.header1,
                content_1: values.content1,
                content_2: values.content2,
                content_image: values.contentImage,
                author_id: user.id || '', // Supabase user id
                featured: values.featured,
                color: values.color,
                tags: values.tags?.map((t: any) => t.value) || [],
                pro_tips: values.proTips,
                booking_button_text: values.bookingButtonText,
                booking_button_content: values.bookingButtonContent,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            if (values.featured) {
                // Get count of existing featured blogs to determine position
                const { count, error: countError } = await supabase
                    .from('blogs')
                    .select('*', { count: 'exact', head: true })
                    .eq('featured', true);

                if (countError) throw countError;

                dataToSave.featured_position = (count || 0) + 1;
            } else {
                delete dataToSave.featured_position;
            }

            // Use the secure admin API to create the blog post
            const res = await fetch('/api/admin/blogs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to create blog post via API');
            }

            toast({
                title: 'Blog Post Created',
                description: 'Your new blog post has been successfully created.',
            });
            router.push('/dashboard/blogs');

        } catch (error: any) {
            console.error('Error creating blog post: ', error);
            console.error('Full Error Object:', JSON.stringify(error, null, 2));
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `An error occurred while creating the blog post. ${error.message || 'Check console for details.'}`,
            });
        }
    };

    return (
        <div>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Create New Blog Post</h1>
                    <p className="text-muted-foreground">Fill in the details to publish a new post.</p>
                </div>
            </div>
            <BlogForm onSubmit={handleCreateBlog} />
        </div>
    );
}
