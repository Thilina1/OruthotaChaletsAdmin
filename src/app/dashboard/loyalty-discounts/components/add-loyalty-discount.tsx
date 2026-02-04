'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface AddLoyaltyDiscountProps {
    onSuccess?: () => void;
}

export function AddLoyaltyDiscount({ onSuccess }: AddLoyaltyDiscountProps) {
    const [name, setName] = useState('');
    const [pointsRequired, setPointsRequired] = useState(0);
    const [discountPercentage, setDiscountPercentage] = useState(0);
    const [isActive, setIsActive] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    const supabase = createClient();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const { error } = await supabase.from('loyalty_discounts').insert([{
                name,
                points_required: pointsRequired,
                discount_percentage: discountPercentage,
                is_active: isActive,
                created_at: new Date().toISOString(),
                // updated_at not in type/schema? Assuming not needed or auto
            }]);

            if (error) throw error;

            toast({ title: "Discount Added", description: "The new loyalty discount has been created successfully." });
            setIsOpen(false);
            // Reset form
            setName('');
            setPointsRequired(0);
            setDiscountPercentage(0);
            setIsActive(true);
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error("Error adding document: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not create the loyalty discount." });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>Add New Discount</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Loyalty Discount</DialogTitle>
                    <DialogDescription>Fill in the details for the new discount tier.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pointsRequired" className="text-right">Points Required</Label>
                            <Input id="pointsRequired" type="number" value={pointsRequired} onChange={e => setPointsRequired(Number(e.target.value))} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="discountPercentage" className="text-right">Discount (%)</Label>
                            <Input id="discountPercentage" type="number" value={discountPercentage} onChange={e => setDiscountPercentage(Number(e.target.value))} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="isActive" className="text-right">Active</Label>
                            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Create Discount</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
