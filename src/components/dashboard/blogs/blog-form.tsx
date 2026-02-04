
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Blog, BlogColor } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import JoditEditor from 'jodit-react';
import { useRef } from 'react';


const blogColorPalettes: { name: BlogColor, className: string }[] = [
    { name: 'amber', className: 'bg-amber-500' },
    { name: 'green', className: 'bg-green-500' },
    { name: 'creme', className: 'bg-orange-200' },
    { name: 'blue', className: 'bg-blue-500' }
];

const formSchema = z.object({
    title: z.string().min(1, 'Title is required.'),
    previewHeader: z.string().min(1, 'Preview header is required.'),
    previewDescription: z.string().min(1, 'Preview description is required.'),
    header1: z.string().min(1, 'Main header is required.'),
    content1: z.string().min(1, 'Content for section 1 is required.'),
    content2: z.string().optional(),
    contentImage: z.string().url('Must be a valid URL.'),
    featured: z.boolean().default(false),
    color: z.enum(['amber', 'green', 'creme', 'blue']).default('amber'),
    tags: z.array(z.object({ value: z.string().min(1, 'Tag cannot be empty.') })),
    proTips: z.array(z.object({
        title: z.string().min(1, 'Pro-tip title is required.'),
        description: z.string().min(1, 'Pro-tip description is required.')
    })),
    bookingButtonText: z.string().min(1, 'Button text is required.'),
    bookingButtonContent: z.string().min(1, 'Button link is required.'),
});

type BlogFormValues = z.infer<typeof formSchema>;

interface BlogFormProps {
    blog?: Blog | null;
    onSubmit: (values: any) => void;
}

export function BlogForm({ blog, onSubmit }: BlogFormProps) {
    const editor = useRef(null);

    const form = useForm<BlogFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: blog?.title || '',
            previewHeader: blog?.preview_header || '',
            previewDescription: blog?.preview_description || '',
            header1: blog?.header_1 || '',
            content1: blog?.content_1 || '',
            content2: blog?.content_2 || '',
            contentImage: blog?.content_image || '',
            featured: blog?.featured || false,
            color: blog?.color || 'amber',
            tags: blog?.tags?.map(t => ({ value: t })) || [{ value: '' }],
            proTips: blog?.pro_tips || [{ title: '', description: '' }],
            bookingButtonText: blog?.booking_button_text || '',
            bookingButtonContent: blog?.booking_button_content || '',
        },
    });

    const { fields: tagFields, append: appendTag, remove: removeTag } = useFieldArray({
        control: form.control,
        name: "tags",
    });

    const { fields: proTipFields, append: appendProTip, remove: removeProTip } = useFieldArray({
        control: form.control,
        name: "proTips",
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Main Details */}
                        <Card>
                            <CardHeader><CardTitle>Main Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="title" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl><Input placeholder="Blog Post Title" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="header1" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Main Header</FormLabel>
                                        <FormControl><Input placeholder="Main Header Inside the Blog" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="contentImage" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Content Image URL</FormLabel>
                                        <FormControl><Input placeholder="https://example.com/image.jpg" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        {/* Preview Details */}
                        <Card>
                            <CardHeader><CardTitle>Preview Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="previewHeader" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Preview Header</FormLabel>
                                        <FormControl><Input placeholder="Short & Catchy Preview Header" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="previewDescription" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Preview Description</FormLabel>
                                        <FormControl><Textarea placeholder="Brief summary for the blog preview card." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        {/* Content Sections */}
                        <Card>
                            <CardHeader><CardTitle>Content</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <FormField control={form.control} name="content1" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Content Section 1</FormLabel>
                                        <FormControl>
                                            <JoditEditor
                                                ref={editor}
                                                value={field.value}
                                                onBlur={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="content2" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Content Section 2 (Optional)</FormLabel>
                                        <FormControl>
                                            <JoditEditor
                                                ref={editor}
                                                value={field.value || ''}
                                                onBlur={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        {/* Pro-Tips Section */}
                        <Card>
                            <CardHeader><CardTitle>Pro-Tips</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {proTipFields.map((field, index) => (
                                    <div key={field.id} className="p-4 border rounded-md space-y-4 relative">
                                        <FormField control={form.control} name={`proTips.${index}.title`} render={({ field }) => (
                                            <FormItem><FormLabel>Tip Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`proTips.${index}.description`} render={({ field }) => (
                                            <FormItem><FormLabel>Tip Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => removeProTip(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" onClick={() => appendProTip({ title: '', description: '' })}><PlusCircle className="mr-2" /> Add Pro-Tip</Button>
                            </CardContent>
                        </Card>

                        {/* Call to Action */}
                        <Card>
                            <CardHeader><CardTitle>Call To Action</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="bookingButtonText" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Booking Button Text</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="bookingButtonContent" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Booking Button Link (URL)</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        {/* Settings */}
                        <Card>
                            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="featured" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5"><FormLabel>Featured Post</FormLabel><FormDescription>Display this post prominently.</FormDescription></div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="color" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Color Palette</FormLabel>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                                            {blogColorPalettes.map(palette => (
                                                <FormItem key={palette.name} className="flex items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value={palette.name} id={palette.name} className="sr-only" />
                                                    </FormControl>
                                                    <FormLabel htmlFor={palette.name} className="flex items-center gap-2 cursor-pointer p-2 rounded-md border border-transparent has-[:checked]:border-primary w-full">
                                                        <span className={`w-5 h-5 rounded-full ${palette.className}`}></span>
                                                        <span className="capitalize">{palette.name}</span>
                                                    </FormLabel>
                                                </FormItem>
                                            ))}
                                        </RadioGroup>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        {/* Tags */}
                        <Card>
                            <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {tagFields.map((field, index) => (
                                    <FormField key={field.id} control={form.control} name={`tags.${index}.value`} render={({ field }) => (
                                        <FormItem>
                                            <div className="flex gap-2">
                                                <FormControl><Input placeholder="e.g., Travel" {...field} /></FormControl>
                                                <Button type="button" variant="destructive" size="icon" onClick={() => removeTag(index)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendTag({ value: '' })}><PlusCircle className="mr-2 h-4 w-4" />Add Tag</Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Button type="submit" size="lg" className="w-full">{blog ? 'Update' : 'Create'} Blog Post</Button>
            </form>
        </Form>
    );
}
