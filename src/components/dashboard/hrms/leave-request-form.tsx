'use client';

import { useForm, useWatch } from 'react-hook-form';
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
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { LeaveSchemeType } from '@/lib/types';

function calcWorkingDays(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (e < s) return 0;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
        if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

const formSchema = z.object({
    leave_type_id: z.string().min(1, 'Please select a leave type'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    is_half_day: z.boolean().default(false),
    half_day_type: z.enum(['morning', 'evening']).optional(),
    reason: z.string().min(1, 'Reason is required'),
}).refine(d => !d.end_date || !d.start_date || d.end_date >= d.start_date, {
    message: 'End date must be on or after start date',
    path: ['end_date'],
});

export type LeaveRequestPayload = {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    half_day_type: string | null;
    reason: string;
};

interface LeaveRequestFormProps {
    schemeTypes: LeaveSchemeType[];
    onSubmit: (values: LeaveRequestPayload) => void;
}

export function LeaveRequestForm({ schemeTypes, onSubmit }: LeaveRequestFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            leave_type_id: '',
            start_date: '',
            end_date: '',
            is_half_day: false,
            half_day_type: undefined,
            reason: '',
        },
    });

    const isHalfDay = useWatch({ control: form.control, name: 'is_half_day' });
    const startDate = useWatch({ control: form.control, name: 'start_date' });
    const endDate = useWatch({ control: form.control, name: 'end_date' });

    const previewDays = isHalfDay ? 0.5 : calcWorkingDays(startDate, endDate);

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        const days_count = values.is_half_day ? 0.5 : calcWorkingDays(values.start_date, values.end_date);
        onSubmit({
            leave_type_id: values.leave_type_id,
            start_date: values.start_date,
            end_date: values.is_half_day ? values.start_date : values.end_date,
            days_count,
            half_day_type: values.is_half_day ? (values.half_day_type ?? 'morning') : null,
            reason: values.reason,
        });
    };

    if (schemeTypes.length === 0) {
        return (
            <div className="text-center py-6 text-muted-foreground text-sm">
                No leave scheme is assigned to your account. Please contact HR to assign a leave scheme.
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="leave_type_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Leave Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {schemeTypes.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({t.days_count} days/{t.reset_period})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="is_half_day"
                    render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0 rounded-md border p-3">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div>
                                <FormLabel className="cursor-pointer">Half Day</FormLabel>
                                <FormDescription>Check to request half a day (0.5 days).</FormDescription>
                            </div>
                        </FormItem>
                    )}
                />

                {isHalfDay && (
                    <FormField
                        control={form.control}
                        name="half_day_type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Half Day Session</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="morning">Morning</SelectItem>
                                        <SelectItem value="evening">Afternoon / Evening</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Start Date</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {!isHalfDay && (
                        <FormField
                            control={form.control}
                            name="end_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>End Date</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                {previewDays > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Working days: <strong className="text-foreground">{previewDays}</strong>
                    </p>
                )}

                <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Reason</FormLabel>
                            <FormControl><Textarea placeholder="Reason for leave..." {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full">Submit Request</Button>
            </form>
        </Form>
    );
}
