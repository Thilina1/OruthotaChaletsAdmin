
'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, PaymentMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Receipt, CreditCard, Wallet, Phone, Loader2, ChevronDown, ChevronUp, Printer, PartyPopper } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ── Billing config types (mirrors restaurant-settings) ────────────────────────
type ChargeType = 'percentage' | 'fixed';
type ChargeEntry = { id: string; name: string; type: ChargeType; value: number; enabled: boolean };
type DiscountEntry = { id: string; name: string; type: ChargeType; value: number; condition: string; enabled: boolean };
type BillingConfig = {
  vat: { enabled: boolean; rate: number };
  service_charges: ChargeEntry[];
  discounts: DiscountEntry[];
  other_charges: ChargeEntry[];
};

const DEFAULT_CONFIG: BillingConfig = {
  vat: { enabled: false, rate: 0 },
  service_charges: [],
  discounts: [],
  other_charges: [],
};

function applyCharge(base: number, entry: ChargeEntry | DiscountEntry): number {
  if (entry.type === 'percentage') return base * (entry.value / 100);
  return entry.value;
}

interface PaymentModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentModal({ order, isOpen, onClose }: PaymentModalProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [billingConfig, setBillingConfig] = useState<BillingConfig>(DEFAULT_CONFIG);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Per-bill overrides: which service/other charges are active this bill
  const [activeCharges, setActiveCharges] = useState<Record<string, boolean>>({});
  const [activeOtherCharges, setActiveOtherCharges] = useState<Record<string, boolean>>({});
  // Which discounts the cashier has selected for this bill
  const [selectedDiscounts, setSelectedDiscounts] = useState<Record<string, boolean>>({});
  // Show/hide breakdown detail
  const [showBreakdown, setShowBreakdown] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerMobile, setCustomerMobile] = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [paidTotal, setPaidTotal] = useState(0);
  const [paidMethod, setPaidMethod] = useState<PaymentMethod>('cash');
  const [paidChange, setPaidChange] = useState(0);

  // ── Load order items + billing config ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !order.id) return;
    setIsLoadingConfig(true);

    const loadConfig = fetch('/api/admin/app-settings?key=restaurant_billing_config').then(r => r.json());
    const loadItems = fetch(`/api/admin/orders?id=${order.id}`).then(r => r.json());

    Promise.all([loadItems, loadConfig]).then(([itemsRes, configRes]) => {
      if (itemsRes.items) {
        setOrderItems(itemsRes.items as OrderItem[]);
      }
      const cfg: BillingConfig = configRes.value
        ? { ...DEFAULT_CONFIG, ...configRes.value }
        : DEFAULT_CONFIG;
      setBillingConfig(cfg);

      const chargeDefaults: Record<string, boolean> = {};
      cfg.service_charges.forEach(sc => { chargeDefaults[sc.id] = sc.enabled; });
      setActiveCharges(chargeDefaults);

      const otherDefaults: Record<string, boolean> = {};
      cfg.other_charges.forEach(oc => { otherDefaults[oc.id] = oc.enabled; });
      setActiveOtherCharges(otherDefaults);

      setSelectedDiscounts({});
    }).finally(() => setIsLoadingConfig(false));
  }, [isOpen, order.id]);

  // Reset cash/method when order changes; pre-fill mobile from order
  useEffect(() => {
    setCashReceived('');
    setCustomerMobile(order.customer_mobile || '');
    setPaymentMethod('cash');
    setConfirmed(!!order.confirmed_total);
    setPaymentDone(false);
  }, [order]);

  // ── Bill calculation ────────────────────────────────────────────────────────
  const {
    subtotal,
    discountLines,
    discountTotal,
    afterDiscount,
    serviceChargeLines,
    serviceChargeTotal,
    otherChargeLines,
    otherChargeTotal,
    vatAmount,
    grandTotal,
  } = useMemo(() => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Discounts applied to subtotal
    const discountLines = billingConfig.discounts
      .filter(d => d.enabled && selectedDiscounts[d.id])
      .map(d => ({ ...d, amount: applyCharge(subtotal, d) }));
    const discountTotal = discountLines.reduce((s, d) => s + d.amount, 0);
    const afterDiscount = Math.max(0, subtotal - discountTotal);

    // Service charges on after-discount amount
    const serviceChargeLines = billingConfig.service_charges
      .filter(sc => activeCharges[sc.id])
      .map(sc => ({ ...sc, amount: applyCharge(afterDiscount, sc) }));
    const serviceChargeTotal = serviceChargeLines.reduce((s, sc) => s + sc.amount, 0);

    // Other charges on after-discount amount
    const otherChargeLines = billingConfig.other_charges
      .filter(oc => activeOtherCharges[oc.id])
      .map(oc => ({ ...oc, amount: applyCharge(afterDiscount, oc) }));
    const otherChargeTotal = otherChargeLines.reduce((s, oc) => s + oc.amount, 0);

    // VAT on (afterDiscount + service + other)
    const vatBase = afterDiscount + serviceChargeTotal + otherChargeTotal;
    const vatAmount = billingConfig.vat.enabled
      ? vatBase * (billingConfig.vat.rate / 100)
      : 0;

    const grandTotal = vatBase + vatAmount;

    return { subtotal, discountLines, discountTotal, afterDiscount, serviceChargeLines, serviceChargeTotal, otherChargeLines, otherChargeTotal, vatAmount, grandTotal };
  }, [order.total_price, billingConfig, activeCharges, activeOtherCharges, selectedDiscounts]);

  const cashReceivedNumber = Number(cashReceived);
  const balance = cashReceivedNumber > 0 ? cashReceivedNumber - grandTotal : 0;
  const canProcess = paymentMethod === 'cash'
    ? cashReceivedNumber >= grandTotal && !isProcessing
    : grandTotal >= 0 && !isProcessing;

  // ── Confirm bill total (send to waiter view without processing payment) ──────
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmBill = async () => {
    setIsConfirming(true);
    try {
      const breakdown = {
        subtotal,
        discount_lines: discountLines.map(d => ({ name: d.name, type: d.type, value: d.value, amount: d.amount })),
        discount_total: discountTotal,
        after_discount: afterDiscount,
        service_charge_lines: serviceChargeLines.map(s => ({ name: s.name, type: s.type, value: s.value, amount: s.amount })),
        service_charge_total: serviceChargeTotal,
        other_charge_lines: otherChargeLines.map(o => ({ name: o.name, type: o.type, value: o.value, amount: o.amount })),
        other_charge_total: otherChargeTotal,
        vat_rate: billingConfig.vat.enabled ? billingConfig.vat.rate : 0,
        vat_amount: vatAmount,
        grand_total: grandTotal,
      };

      const { error } = await supabase.from('orders').update({
        confirmed_total: grandTotal,
        bill_breakdown: breakdown,
        ...(customerMobile ? { customer_mobile: customerMobile } : {}),
      }).eq('id', order.id);
      if (error) throw error;
      setConfirmed(true);
      toast({ title: 'Bill Confirmed', description: `LKR ${grandTotal.toFixed(2)} sent to waiter view.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to confirm bill.' });
    } finally {
      setIsConfirming(false);
    }
  };

  // ── Payment handler ─────────────────────────────────────────────────────────
  const handleProcessPayment = async () => {
    if (!canProcess) return;
    setIsProcessing(true);
    try {
      const breakdown = {
        subtotal,
        discount_lines: discountLines.map(d => ({ name: d.name, type: d.type, value: d.value, amount: d.amount })),
        discount_total: discountTotal,
        after_discount: afterDiscount,
        service_charge_lines: serviceChargeLines.map(s => ({ name: s.name, type: s.type, value: s.value, amount: s.amount })),
        service_charge_total: serviceChargeTotal,
        other_charge_lines: otherChargeLines.map(o => ({ name: o.name, type: o.type, value: o.value, amount: o.amount })),
        other_charge_total: otherChargeTotal,
        vat_rate: billingConfig.vat.enabled ? billingConfig.vat.rate : 0,
        vat_amount: vatAmount,
        grand_total: grandTotal,
      };
      const { error } = await supabase.from('orders').update({
        status: 'closed',
        confirmed_total: grandTotal,
        bill_breakdown: breakdown,
        updated_at: new Date().toISOString(),
        ...(customerMobile ? { customer_mobile: customerMobile } : {}),
      }).eq('id', order.id);
      if (error) throw error;

      if (order.table_id) {
        await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', order.table_id);
      }

      setPaidTotal(grandTotal);
      setPaidMethod(paymentMethod);
      setPaidChange(paymentMethod === 'cash' ? Math.max(0, cashReceivedNumber - grandTotal) : 0);
      setPaymentDone(true);
    } catch (error) {
      console.error('Payment error:', error);
      toast({ variant: 'destructive', title: 'Payment Failed', description: 'Error processing payment.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmt = (n: number) => `LKR ${n.toFixed(2)}`;
  const hasCharges = billingConfig.service_charges.length > 0 || billingConfig.other_charges.length > 0 || billingConfig.vat.enabled;
  const hasDiscounts = billingConfig.discounts.filter(d => d.enabled).length > 0;

  const handlePrint = () => window.print();

  // ── Payment success screen ──────────────────────────────────────────────────
  if (paymentDone) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="p-4 bg-green-100 rounded-full">
              <PartyPopper className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-700">Payment Successful!</h2>
              <p className="text-muted-foreground text-sm mt-1">Table {order.table_number} — {order.waiter_name}</p>
            </div>

            <div className="w-full border rounded-lg divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5 font-bold text-base">
                <span>Total Paid</span>
                <span className="text-green-700">{fmt(paidTotal)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-muted-foreground">
                <span>Payment Method</span>
                <span className="font-medium text-foreground capitalize flex items-center gap-1">
                  {paidMethod === 'cash' ? <Wallet className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                  {paidMethod}
                </span>
              </div>
              {paidMethod === 'cash' && paidChange > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-muted-foreground">
                  <span>Change Returned</span>
                  <span className="font-medium text-foreground">{fmt(paidChange)}</span>
                </div>
              )}
              {customerMobile && (
                <div className="flex justify-between px-4 py-2.5 text-muted-foreground">
                  <span>Customer Mobile</span>
                  <span className="font-medium text-foreground">{customerMobile}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full pt-2">
              <Button variant="outline" className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Print Receipt
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Bill — Table {order.table_number}
          </DialogTitle>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Order: <span className="font-mono">{order.id.slice(0, 8)}…</span></div>
            {order.waiter_name && <div>Waiter: {order.waiter_name}</div>}
            {customerMobile && <div>Customer Mobile: <span className="font-medium text-foreground">{customerMobile}</span></div>}
          </div>
        </DialogHeader>

        {isLoadingConfig ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-4 py-2">

              {/* Order items */}
              <div className="space-y-1.5">
                {orderItems.length > 0 ? orderItems.map((item, i) => (
                  <div key={item.id || i} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                    <span>{fmt(item.price * item.quantity)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No item details available.</p>
                )}
              </div>

              <Separator />

              {/* Bill breakdown toggle */}
              <button
                className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                onClick={() => setShowBreakdown(v => !v)}
              >
                Bill Breakdown
                {showBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showBreakdown && (
                <div className="space-y-2 text-sm">
                  {/* Subtotal */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>

                  {/* Discounts */}
                  {hasDiscounts && (
                    <div className="space-y-2 border rounded-lg p-3 bg-green-50/50 dark:bg-green-950/20">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">Discounts</p>
                      {billingConfig.discounts.filter(d => d.enabled).map(d => (
                        <label key={d.id} className="flex items-start gap-2 cursor-pointer">
                          <Checkbox
                            className="mt-0.5"
                            checked={!!selectedDiscounts[d.id]}
                            onCheckedChange={(v) => setSelectedDiscounts(prev => ({ ...prev, [d.id]: !!v }))}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{d.name}</span>
                            {d.condition && <span className="ml-1 text-xs text-muted-foreground">({d.condition})</span>}
                          </div>
                          <span className="text-green-700 dark:text-green-400 whitespace-nowrap">
                            -{d.type === 'percentage' ? `${d.value}%` : fmt(d.value)}
                          </span>
                        </label>
                      ))}
                      {discountTotal > 0 && (
                        <div className="flex justify-between text-green-700 dark:text-green-400 font-medium pt-1 border-t border-green-200 dark:border-green-800">
                          <span>Total Discount</span>
                          <span>-{fmt(discountTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* After discount subtotal (only show if discounts applied) */}
                  {discountTotal > 0 && (
                    <div className="flex justify-between text-sm font-medium">
                      <span>After Discount</span>
                      <span>{fmt(afterDiscount)}</span>
                    </div>
                  )}

                  {/* Service charges */}
                  {billingConfig.service_charges.length > 0 && (
                    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service Charges</p>
                      {billingConfig.service_charges.map(sc => (
                        <div key={sc.id} className="flex items-center gap-2">
                          <Switch
                            className="scale-75"
                            checked={!!activeCharges[sc.id]}
                            onCheckedChange={(v) => setActiveCharges(prev => ({ ...prev, [sc.id]: v }))}
                          />
                          <span className="flex-1">{sc.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {sc.type === 'percentage' ? `${sc.value}%` : fmt(sc.value)}
                          </Badge>
                          {activeCharges[sc.id] && (
                            <span className="text-sm w-24 text-right">
                              {fmt(applyCharge(afterDiscount, sc))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Other charges */}
                  {billingConfig.other_charges.length > 0 && (
                    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Other Charges</p>
                      {billingConfig.other_charges.map(oc => (
                        <div key={oc.id} className="flex items-center gap-2">
                          <Switch
                            className="scale-75"
                            checked={!!activeOtherCharges[oc.id]}
                            onCheckedChange={(v) => setActiveOtherCharges(prev => ({ ...prev, [oc.id]: v }))}
                          />
                          <span className="flex-1">{oc.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {oc.type === 'percentage' ? `${oc.value}%` : fmt(oc.value)}
                          </Badge>
                          {activeOtherCharges[oc.id] && (
                            <span className="text-sm w-24 text-right">
                              {fmt(applyCharge(afterDiscount, oc))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* VAT */}
                  {billingConfig.vat.enabled && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT ({billingConfig.vat.rate}%)</span>
                      <span>{fmt(vatAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Grand total */}
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>{fmt(grandTotal)}</span>
              </div>

              <Separator />

              {/* Customer mobile */}
              <div className="space-y-1.5">
                <Label htmlFor="customer-mobile" className="text-sm">Customer Mobile (Loyalty)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer-mobile"
                    placeholder="e.g. 0771234567"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    className="pl-10"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Payment method */}
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}
                className="flex gap-3"
              >
                <Label htmlFor="cash" className="flex items-center gap-2 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:border-primary flex-1 cursor-pointer">
                  <RadioGroupItem value="cash" id="cash" />
                  <Wallet className="h-4 w-4" /> Cash
                </Label>
                <Label htmlFor="card" className="flex items-center gap-2 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:border-primary flex-1 cursor-pointer">
                  <RadioGroupItem value="card" id="card" />
                  <CreditCard className="h-4 w-4" /> Card
                </Label>
              </RadioGroup>

              {/* Cash received / balance */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="cash-received">Cash Received</Label>
                    <Input
                      id="cash-received"
                      type="number"
                      placeholder="0.00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-32 h-9 text-right"
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Balance</span>
                    <span className={balance > 0 ? 'text-green-600' : ''}>
                      {fmt(Math.max(0, balance))}
                    </span>
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing || isConfirming}>Cancel</Button>
          <Button
            variant={confirmed ? 'outline' : 'secondary'}
            onClick={handleConfirmBill}
            disabled={isLoadingConfig || isConfirming || isProcessing}
            className="flex-1"
          >
            {isConfirming
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming…</>
              : confirmed
                ? <><CheckCircle className="mr-2 h-4 w-4 text-green-600" />Bill Confirmed</>
                : <><CheckCircle className="mr-2 h-4 w-4" />Confirm Bill</>
            }
          </Button>
          <Button onClick={handleProcessPayment} disabled={!canProcess || isLoadingConfig} className="flex-1">
            {isProcessing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
              : <><CheckCircle className="mr-2 h-4 w-4" />Pay {fmt(grandTotal)}</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
