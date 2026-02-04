
'use client';

import { useState, useEffect } from 'react';
import { DateRange, DayPicker } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { addDays, startOfToday } from 'date-fns';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (range: DateRange | undefined) => void;
  initialDateRange?: DateRange;
  disabled?: (date: Date) => boolean;
}

export function DateRangePickerModal({
  isOpen,
  onClose,
  onSave,
  initialDateRange,
  disabled,
}: DateRangePickerModalProps) {
  const [range, setRange] = useState<DateRange | undefined>(initialDateRange);

  useEffect(() => {
    if (isOpen) {
      setRange(initialDateRange);
    }
  }, [initialDateRange, isOpen]);

  const handleSave = () => {
    onSave(range);
  };
  
  const today = startOfToday();

  const presets = [
      { label: 'Today', range: { from: today, to: today } },
      { label: 'Next 7 Days', range: { from: today, to: addDays(today, 6) } },
      { label: 'Next 30 Days', range: { from: today, to: addDays(today, 29) } },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-fit">
        <DialogHeader>
          <DialogTitle>Select Check-in and Check-out Dates</DialogTitle>
        </DialogHeader>
        <div className="flex flex-row gap-4">
            <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
                pagedNavigation
                disabled={disabled}
                initialFocus
                modifiersClassNames={{
                  selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90',
                  day_range_start: 'day-range-start',
                  day_range_end: 'day-range-end',
                  day_range_middle: 'bg-accent/80 text-accent-foreground',
                }}
            />
             <div className="flex flex-col space-y-2 border-l pl-4">
                <h3 className="text-sm font-medium text-muted-foreground">Presets</h3>
                {presets.map(({ label, range }) => (
                    <Button key={label} variant="ghost" onClick={() => setRange(range)}>
                        {label}
                    </Button>
                ))}
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!range?.from || !range?.to}>Save Dates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
