'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    tasks_completed: z.string().min(1, 'Tasks completed is required'),
    issues_faced: z.string().optional(),
    next_day_plan: z.string().optional(),
});

interface DailyReportFormProps {
    onSubmit: (values: z.infer<typeof formSchema>) => void;
}

export function DailyReportForm({ onSubmit }: DailyReportFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            tasks_completed: '',
            issues_faced: '',
            next_day_plan: '',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="tasks_completed"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tasks Completed</FormLabel>
                            <FormControl>
                                <Textarea placeholder="List the tasks you completed today..." className="h-24" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="issues_faced"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Issues Faced (Optional)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Any challenges or blockers..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="next_day_plan"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Next Day Plan (Optional)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="What do you plan to do tomorrow?" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full">Submit Report</Button>
            </form>
        </Form>
    );
}
