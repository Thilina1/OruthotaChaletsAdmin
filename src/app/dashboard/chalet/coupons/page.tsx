'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ChaletCoupon } from '@/lib/types';
import { Pencil, Plus, Trash2 } from 'lucide-react';

const emptyCouponForm = {
    code: '',
    name: '',
    description: '',
    discount_type: 'fixed' as 'fixed' | 'percentage',
    discount_value: 0,
    max_discount_amount: 0,
    min_bill_amount: 0,
    max_bill_amount: 0,
    valid_from: '',
    valid_to: '',
    max_usage: 0,
    is_active: true,
};

function formatCurrency(n: number) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: 2 });
}

export default function ChaletCouponsPage() {
    const { toast } = useToast();
    const [coupons, setCoupons] = useState<ChaletCoupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyCouponForm });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchCoupons = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/chalet/coupons');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load coupons');
            setCoupons(data.coupons || []);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to load coupons', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

    const openNew = () => {
        setEditingId(null);
        setForm({ ...emptyCouponForm });
        setDialogOpen(true);
    };

    const openEdit = (coupon: ChaletCoupon) => {
        setEditingId(coupon.id);
        setForm({
            code: coupon.code,
            name: coupon.name || '',
            description: coupon.description || '',
            discount_type: coupon.discount_type,
            discount_value: Number(coupon.discount_value || 0),
            max_discount_amount: Number(coupon.max_discount_amount || 0),
            min_bill_amount: Number(coupon.min_bill_amount || 0),
            max_bill_amount: Number(coupon.max_bill_amount || 0),
            valid_from: coupon.valid_from || '',
            valid_to: coupon.valid_to || '',
            max_usage: Number(coupon.max_usage || 0),
            is_active: coupon.is_active,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim()) {
            toast({ title: 'Validation', description: 'Coupon code is required', variant: 'destructive' });
            return;
        }
        if (Number(form.discount_value || 0) <= 0) {
            toast({ title: 'Validation', description: 'Discount value must be greater than zero', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                code: form.code.trim().toUpperCase(),
                name: form.name.trim() || null,
                description: form.description.trim() || null,
                max_discount_amount: form.discount_type === 'percentage' && Number(form.max_discount_amount || 0) > 0 ? Number(form.max_discount_amount) : null,
                min_bill_amount: Number(form.min_bill_amount || 0),
                max_bill_amount: Number(form.max_bill_amount || 0) > 0 ? Number(form.max_bill_amount) : null,
                valid_from: form.valid_from || null,
                valid_to: form.valid_to || null,
                max_usage: Number(form.max_usage || 0) > 0 ? Number(form.max_usage) : null,
                ...(editingId ? { id: editingId } : {}),
            };
            const res = await fetch('/api/chalet/coupons', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save coupon');
            toast({ title: 'Success', description: editingId ? 'Coupon updated' : 'Coupon created' });
            setDialogOpen(false);
            fetchCoupons();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/chalet/coupons?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete coupon');
            toast({ title: 'Deleted', description: 'Coupon removed' });
            fetchCoupons();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Coupons</h1>
                    <p className="text-muted-foreground">Manage chalet booking coupons</p>
                </div>
                <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Coupon
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Coupon List</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Discount</TableHead>
                                    <TableHead>Bill Limit</TableHead>
                                    <TableHead>Valid Dates</TableHead>
                                    <TableHead>Usage</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                        </TableRow>
                                    ))
                                ) : coupons.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                            No coupons yet. Create a coupon for chalet bookings.
                                        </TableCell>
                                    </TableRow>
                                ) : coupons.map(coupon => (
                                    <TableRow key={coupon.id}>
                                        <TableCell>
                                            <div className="font-mono font-semibold">{coupon.code}</div>
                                            {coupon.name && <div className="text-xs text-muted-foreground">{coupon.name}</div>}
                                        </TableCell>
                                        <TableCell>
                                            {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `LKR ${formatCurrency(Number(coupon.discount_value || 0))}`}
                                            {coupon.max_discount_amount ? <div className="text-xs text-muted-foreground">Max LKR {formatCurrency(Number(coupon.max_discount_amount))}</div> : null}
                                        </TableCell>
                                        <TableCell>
                                            LKR {formatCurrency(Number(coupon.min_bill_amount || 0))}
                                            {' -> '}
                                            {coupon.max_bill_amount ? `LKR ${formatCurrency(Number(coupon.max_bill_amount))}` : 'No max'}
                                        </TableCell>
                                        <TableCell className="text-sm">{coupon.valid_from || 'Any'} {'->'} {coupon.valid_to || 'Any'}</TableCell>
                                        <TableCell>{Number(coupon.used_count || 0)} / {coupon.max_usage || 'Unlimited'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={coupon.is_active ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                                                {coupon.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}>
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={deletingId === coupon.id} onClick={() => handleDelete(coupon.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Coupon' : 'New Coupon'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 md:grid-cols-2">
                        <div className="space-y-1">
                            <Label>Coupon Code *</Label>
                            <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="SUMMER5000" />
                        </div>
                        <div className="space-y-1">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Seasonal offer" />
                        </div>
                        <div className="space-y-1">
                            <Label>Discount Type</Label>
                            <Select value={form.discount_type} onValueChange={value => setForm(p => ({ ...p, discount_type: value as 'fixed' | 'percentage' }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fixed amount</SelectItem>
                                    <SelectItem value="percentage">Percentage</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{form.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount'}</Label>
                            <Input type="number" min={0} step={form.discount_type === 'percentage' ? 1 : 0.01} value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        {form.discount_type === 'percentage' && (
                            <div className="space-y-1">
                                <Label>Maximum Discount Amount</Label>
                                <Input type="number" min={0} step={0.01} value={form.max_discount_amount} onChange={e => setForm(p => ({ ...p, max_discount_amount: parseFloat(e.target.value) || 0 }))} placeholder="0 for no limit" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label>Apply From Bill Amount</Label>
                            <Input type="number" min={0} step={0.01} value={form.min_bill_amount} onChange={e => setForm(p => ({ ...p, min_bill_amount: parseFloat(e.target.value) || 0 }))} placeholder="0 for any amount" />
                        </div>
                        <div className="space-y-1">
                            <Label>Apply Until Bill Amount</Label>
                            <Input type="number" min={0} step={0.01} value={form.max_bill_amount} onChange={e => setForm(p => ({ ...p, max_bill_amount: parseFloat(e.target.value) || 0 }))} placeholder="0 for no maximum" />
                        </div>
                        <div className="space-y-1">
                            <Label>Valid From</Label>
                            <Input type="date" value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Valid To</Label>
                            <Input type="date" value={form.valid_to} onChange={e => setForm(p => ({ ...p, valid_to: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Maximum Usage</Label>
                            <Input type="number" min={0} value={form.max_usage} onChange={e => setForm(p => ({ ...p, max_usage: parseInt(e.target.value) || 0 }))} placeholder="0 for unlimited" />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <Checkbox checked={form.is_active} onCheckedChange={checked => setForm(p => ({ ...p, is_active: checked === true }))} />
                            <Label>Active coupon</Label>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional internal coupon details..." rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
