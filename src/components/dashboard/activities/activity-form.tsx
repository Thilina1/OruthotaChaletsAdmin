
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Activity } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';

const activityTypes = ['priceable', 'non-priceable'] as const;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Activity name is required.' }),
  description: z.string().optional(),
  type: z.enum(activityTypes),
  pricePerPerson: z.coerce.number().optional(),
});

interface ActivityFormProps {
  activity?: Activity | null;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
}

export function ActivityForm({ activity, onSubmit }: ActivityFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: activity?.name || '',
      description: activity?.description || '',
      type: activity?.type || 'non-priceable',
      pricePerPerson: activity?.price_per_person || 0,
    },
  });

  const watchedActivityType = useWatch({
    control: form.control,
    name: 'type',
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] w-full">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Guided Jungle Trek" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="A short description of the activity." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Activity Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-4"
                  >
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="non-priceable" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Non-Priceable
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="priceable" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Priceable
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchedActivityType === 'priceable' && (
            <FormField
              control={form.control}
              name="pricePerPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price Per Person (LKR)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 2500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </ScrollArea>
        <Button type="submit" className="w-full">
          {activity ? 'Update Activity' : 'Create Activity'}
        </Button>
      </form>
    </Form>
  );
}
