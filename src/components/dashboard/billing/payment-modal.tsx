
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, PaymentMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Receipt, CreditCard, Wallet, Phone } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PaymentModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentModal({ order, isOpen, onClose }: PaymentModalProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerMobile, setCustomerMobile] = useState('');

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (order.id) {
      supabase.from('order_items').select('*').eq('order_id', order.id)
        .then(({ data }) => {
          if (data) setOrderItems(data as any);
        });
    }
  }, [order.id, supabase]);

  const subtotal = order.total_price;
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  const cashReceivedNumber = Number(cashReceived);
  const balance = cashReceivedNumber > 0 ? cashReceivedNumber - total : 0;

  const canProcessCashPayment = cashReceivedNumber >= total && !isProcessing;
  const canProcessCardPayment = total >= 0 && !isProcessing;
  const canProcessPayment = paymentMethod === 'cash' ? canProcessCashPayment : canProcessCardPayment;


  const handleProcessPayment = async () => {
    if (!canProcessPayment) return;
    setIsProcessing(true);

    try {
      // Update Order
      const { error } = await supabase.from('orders').update({
        status: 'closed', // Schema allows 'closed' as final state
        updated_at: new Date().toISOString()
        // Payment details like method, discount, cashReceived etc. are not in schema for Orders table.
        // If we need to store them, we need columns or a 'bills' table.
        // For now, we just close the order.
      }).eq('id', order.id);

      if (error) throw error;

      // Update Table Status
      if (order.table_id) {
        await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', order.table_id);
      }

      /* Loyalty logic commented out as table missing
      if (customerMobile) {
          // ...
      }
      */

      toast({
        title: 'Payment Successful',
        description: `Order for Table ${order.table_number} has been paid.`,
      });
      onClose();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({ variant: 'destructive', title: 'Payment Failed', description: 'Error processing payment.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // TODO: Integrate Receipt printing here after successful payment or provide a "Print Receipt" button in the modal before closing.
  // The Receipt component exists at @/components/dashboard/billing/receipt.tsx but needs to be hooked up.

  useEffect(() => {
    setDiscount(0);
    setCashReceived('');
    setCustomerMobile('');
  }, [order]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt />
            Bill for Table {order.table_number}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <div>Order ID: <span className="font-mono">{order.id.slice(0, 8)}...</span></div>
            {order.waiter_name && <div>Waiter: {order.waiter_name}</div>}
          </div>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
            {orderItems && orderItems.length > 0 ? orderItems.map((item, index) => (
              <div key={item.id || index} className="flex justify-between items-center text-sm">
                <span>{item.name} x{item.quantity}</span>
                <span>LKR {(item.price * item.quantity).toFixed(2)}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">This bill does not contain item details.</p>
            )}
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">Subtotal</span>
              <span>LKR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <Label htmlFor="discount">Discount (%)</Label>
              <Input
                id="discount"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-24 h-8"
                disabled={isProcessing}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Discount Amount</span>
              <span>-LKR {discountAmount.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>LKR {total.toFixed(2)}</span>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="customer-mobile">Customer Mobile Number (for Loyalty)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-mobile"
                  placeholder="e.g., 0771234567"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  className="pl-10"
                  disabled={isProcessing}
                />
              </div>
            </div>

            <RadioGroup defaultValue="cash" onValueChange={(value: PaymentMethod) => setPaymentMethod(value)} className="flex gap-4 pt-2">
              <Label htmlFor="cash" className="flex items-center gap-2 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary flex-1 cursor-pointer">
                <RadioGroupItem value="cash" id="cash" />
                <Wallet /> Cash
              </Label>
              <Label htmlFor="card" className="flex items-center gap-2 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary flex-1 cursor-pointer">
                <RadioGroupItem value="card" id="card" />
                <CreditCard /> Card
              </Label>
            </RadioGroup>

            {paymentMethod === 'cash' && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="cash-received">Cash Received</Label>
                  <Input
                    id="cash-received"
                    type="number"
                    placeholder='0.00'
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-32 h-9 text-right"
                    disabled={isProcessing}
                  />
                </div>
                <div className="flex justify-between font-medium text-lg">
                  <span>Balance</span>
                  <span className={balance > 0 ? 'text-green-600 font-bold' : ''}>LKR {balance > 0 ? balance.toFixed(2) : '0.00'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleProcessPayment} disabled={!canProcessPayment}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Pay Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
