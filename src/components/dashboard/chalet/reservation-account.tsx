'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ChaletBooking } from '@/lib/types';

// Reservation account (ledger) for a chalet booking: one tab per kind of
// charge, each row a debit (charge) or credit (payment/discount) with a
// running balance. Amounts are in LKR, as on the Front Desk bill.

export type LedgerRow = {
    date: string | null;
    invNo: string | null;
    group?: string;
    description: string;
    details?: string[];
    tax: number | null;
    debit: number;
    credit: number;
};
export type LedgerTab = { key: string; label: string; rows: LedgerRow[] };
type Receipt = { bill_number: string; date: string; payment_method: string | null; total: number };

const amount = (value: number) => Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const balanceText = (value: number) => (Math.abs(value) < 0.005 ? '0.00' : `${amount(Math.abs(value))} ${value > 0 ? 'DR' : 'CR'}`);
const rowDate = (value: string | null) => (value ? format(new Date(value.length === 10 ? `${value}T00:00:00` : value), 'd MMM yyyy') : '—');
export const tabBalance = (rows: LedgerRow[]) => rows.reduce((sum, row) => sum + row.debit - row.credit, 0);

// One line per invoice number (its charges, discounts and payment added
// up); rows without an invoice number (e.g. payments) stay as they are.
type InvoiceLine = { key: string; date: string | null; invNo: string | null; description: string; tax: number; debit: number; credit: number; lines: LedgerRow[] };
function invoiceLines(rows: LedgerRow[]): InvoiceLine[] {
    const result: InvoiceLine[] = [];
    const byInvoice = new Map<string, InvoiceLine>();
    rows.forEach((row, index) => {
        if (!row.invNo) {
            result.push({ key: `row-${index}`, date: row.date, invNo: null, description: row.description, tax: Number(row.tax || 0), debit: row.debit, credit: row.credit, lines: [row] });
            return;
        }
        const existing = byInvoice.get(row.invNo);
        if (existing) {
            existing.tax += Number(row.tax || 0);
            existing.debit += row.debit;
            existing.credit += row.credit;
            existing.lines.push(row);
            if (row.date && (!existing.date || row.date < existing.date)) existing.date = row.date;
            return;
        }
        const line: InvoiceLine = { key: `inv-${row.invNo}`, date: row.date, invNo: row.invNo, description: row.group || row.description, tax: Number(row.tax || 0), debit: row.debit, credit: row.credit, lines: [row] };
        byInvoice.set(row.invNo, line);
        result.push(line);
    });
    return result;
}

export type ReservationAccountData = {
    tabs: LedgerTab[];
    receipts: Receipt[];
    customerLinked: boolean;
    loading: boolean;
    error: string | null;
};

// Loads the booking's ledger (used by the Account panel balances and the
// Reservation Account window).
export function useReservationAccount(bookingId: string | null | undefined): ReservationAccountData {
    const [tabs, setTabs] = useState<LedgerTab[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [customerLinked, setCustomerLinked] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!bookingId) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/chalet/bookings/${bookingId}/account`)
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load the account');
                if (cancelled) return;
                setTabs(data.tabs || []);
                setReceipts(data.receipts || []);
                setCustomerLinked(!!data.customer);
                setError(null);
            })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [bookingId]);

    return { tabs, receipts, customerLinked, loading, error };
}

// The Reservation Account window (opened from the Account panel).
export function ReservationAccount({ booking, roomLabel, account, open, initialTab = 'all', onOpenChange }: {
    booking: ChaletBooking;
    roomLabel: string;
    account: ReservationAccountData;
    open: boolean;
    initialTab?: string;
    onOpenChange: (open: boolean) => void;
}) {
    const { tabs, receipts, customerLinked, loading, error } = account;
    const [activeTab, setActiveTab] = useState(initialTab);
    const [openInvoice, setOpenInvoice] = useState<InvoiceLine | null>(null);
    useEffect(() => { if (open) setActiveTab(initialTab); }, [open, initialTab]);

    const allRows = useMemo(() => tabs.flatMap(tab => tab.rows), [tabs]);
    const tabList = [{ key: 'all', label: 'All', rows: allRows }, ...tabs];
    const rows = tabList.find(tab => tab.key === activeTab)?.rows || [];
    const lines = invoiceLines(rows);
    const totals = rows.reduce((sum, row) => ({ tax: sum.tax + Number(row.tax || 0), debit: sum.debit + row.debit, credit: sum.credit + row.credit }), { tax: 0, debit: 0, credit: 0 });
    let running = 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-7xl flex-col gap-0 overflow-hidden p-0">
            <DialogTitle className="sr-only">Reservation Account</DialogTitle>
            <DialogDescription className="sr-only">Charges and payments for {booking.booking_ref}</DialogDescription>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-slate-600 px-4 py-3 pr-12 text-sm text-white">
                <span className="text-base font-semibold">Reservation Account</span>
                <span>Res No: <span className="font-medium">{booking.booking_ref}</span></span>
                <span>Name: <span className="font-medium">{booking.customer_name}</span></span>
                <span>Room: <span className="font-medium">{roomLabel}</span></span>
                <span className="ml-auto">All amounts in LKR</span>
            </div>

            <div className="flex flex-wrap gap-1 border-b px-3 pt-3">
                {tabList.map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`rounded-t-md border border-b-0 px-3 py-1.5 text-sm ${activeTab === tab.key ? 'bg-amber-300 font-semibold text-amber-950' : 'bg-muted/40 hover:bg-muted'}`}
                    >
                        {tab.label} {amount(tabBalance(tab.rows))}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading account…</div>
            ) : error ? (
                <div className="p-6 text-sm text-red-600">{error}</div>
            ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/60 text-left text-xs font-semibold">
                            <tr>
                                <th className="w-[120px] border-r px-3 py-2">Date</th>
                                <th className="w-[150px] border-r px-3 py-2">Inv No</th>
                                <th className="border-r px-3 py-2">Description</th>
                                <th className="w-[110px] border-r px-3 py-2 text-right">Tax</th>
                                <th className="w-[130px] border-r px-3 py-2 text-right">Debit</th>
                                <th className="w-[130px] border-r px-3 py-2 text-right">Credit</th>
                                <th className="w-[150px] border-r px-3 py-2 text-right">Balance</th>
                                <th className="w-[110px] px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 ? (
                                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No entries.</td></tr>
                            ) : lines.map(line => {
                                running += line.debit - line.credit;
                                const isInvoice = !!line.invNo;
                                return (
                                    <tr key={line.key} className="border-t align-middle hover:bg-muted/30">
                                        <td className="border-r px-3 py-1.5 whitespace-nowrap text-muted-foreground">{rowDate(line.date)}</td>
                                        <td className="border-r px-3 py-1.5 whitespace-nowrap">{line.invNo || ''}</td>
                                        <td className="border-r px-3 py-1.5">
                                            {line.description}
                                            {isInvoice && line.lines.length > 1 && <span className="ml-1 text-xs text-muted-foreground">({line.lines.length} lines)</span>}
                                            {!isInvoice && line.lines[0].details?.map((detail, index) => <p key={index} className="text-xs text-sky-700">{detail}</p>)}
                                        </td>
                                        <td className="border-r px-3 py-1.5 text-right tabular-nums">{line.tax ? amount(line.tax) : ''}</td>
                                        <td className="border-r px-3 py-1.5 text-right tabular-nums">{line.debit ? amount(line.debit) : ''}</td>
                                        <td className="border-r px-3 py-1.5 text-right tabular-nums text-green-700">{line.credit ? amount(line.credit) : ''}</td>
                                        <td className="border-r px-3 py-1.5 text-right tabular-nums">{balanceText(running)}</td>
                                        <td className="px-2 py-1 text-center">
                                            {isInvoice && (
                                                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setOpenInvoice(line)}>
                                                    <FileText className="mr-1 h-3.5 w-3.5" /> View bill
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot className="border-t-2 bg-muted/40 font-semibold">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{totals.tax ? amount(totals.tax) : ''}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{amount(totals.debit)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-green-700">{amount(totals.credit)}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums ${totals.debit - totals.credit > 0.005 ? 'text-red-700' : 'text-green-700'}`}>{balanceText(totals.debit - totals.credit)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    {!customerLinked && (
                        <p className="border-t px-4 py-2 text-xs text-muted-foreground">Restaurant orders and services appear here once the guest has a customer record (created at check-in).</p>
                    )}
                </div>
            )}

            {receipts.length > 0 && (
                <div className="max-h-48 shrink-0 overflow-y-auto border-t p-4">
                    <h4 className="mb-2 text-sm font-semibold">Receipts (Front Desk bills)</h4>
                    <div className="space-y-1 text-sm">
                        {receipts.map(receipt => (
                            <div key={receipt.bill_number} className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5">
                                <span className="font-medium">{receipt.bill_number}</span>
                                <span className="text-muted-foreground">{rowDate(receipt.date)}{receipt.payment_method ? ` · ${receipt.payment_method.replace(/_/g, ' ')}` : ''}</span>
                                <span className="tabular-nums">LKR {amount(receipt.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <InvoiceDialog invoice={openInvoice} booking={booking} roomLabel={roomLabel} onClose={() => setOpenInvoice(null)} />
        </DialogContent>
        </Dialog>
    );
}

// Full bill for one invoice number: every line with its details.
function InvoiceDialog({ invoice, booking, roomLabel, onClose }: { invoice: InvoiceLine | null; booking: ChaletBooking; roomLabel: string; onClose: () => void }) {
    const printBill = () => {
        const node = document.getElementById('ledger-invoice-print');
        if (!node) return;
        const popup = window.open('', '_blank', 'width=820,height=900');
        if (!popup) return;
        popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${invoice?.invNo || 'Bill'}</title>
            <style>body{font-family:system-ui,sans-serif;font-size:12px;color:#111;margin:24px}table{width:100%;border-collapse:collapse}
            th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f3f4f6}
            .r{text-align:right}.muted{color:#555}.detail{color:#0369a1;font-size:11px;padding-left:12px}h2{margin:0 0 4px}</style></head>
            <body>${node.innerHTML}</body></html>`);
        popup.document.close();
        popup.focus();
        popup.print();
    };
    const debit = invoice?.debit || 0;
    const credit = invoice?.credit || 0;
    return (
        <Dialog open={!!invoice} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{invoice?.description} · {invoice?.invNo}</DialogTitle>
                    <DialogDescription>{booking.customer_name} · {roomLabel} · Res No {booking.booking_ref}</DialogDescription>
                </DialogHeader>
                {invoice && (
                    <div id="ledger-invoice-print">
                        <h2 className="hidden">{invoice.description} · {invoice.invNo}</h2>
                        <p className="muted mb-3 text-sm text-muted-foreground">
                            Guest: {booking.customer_name} · Room: {roomLabel} · Res No: {booking.booking_ref} · Date: {rowDate(invoice.date)}
                        </p>
                        <table className="w-full text-sm">
                            <thead className="bg-muted/60 text-left text-xs font-semibold">
                                <tr>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Description</th>
                                    <th className="r px-3 py-2 text-right">Tax</th>
                                    <th className="r px-3 py-2 text-right">Debit</th>
                                    <th className="r px-3 py-2 text-right">Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lines.map((line, index) => (
                                    <tr key={index} className="border-t align-top">
                                        <td className="muted px-3 py-1.5 whitespace-nowrap text-muted-foreground">{rowDate(line.date)}</td>
                                        <td className="px-3 py-1.5">
                                            {line.description}
                                            {line.details?.map((detail, detailIndex) => <div key={detailIndex} className="detail pl-3 text-xs text-sky-700">{detail}</div>)}
                                        </td>
                                        <td className="r px-3 py-1.5 text-right tabular-nums">{line.tax ? amount(line.tax) : ''}</td>
                                        <td className="r px-3 py-1.5 text-right tabular-nums">{line.debit ? amount(line.debit) : ''}</td>
                                        <td className="r px-3 py-1.5 text-right tabular-nums text-green-700">{line.credit ? amount(line.credit) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 font-semibold">
                                <tr>
                                    <td colSpan={2} className="r px-3 py-2 text-right">Total</td>
                                    <td className="r px-3 py-2 text-right tabular-nums">{invoice.tax ? amount(invoice.tax) : ''}</td>
                                    <td className="r px-3 py-2 text-right tabular-nums">{amount(debit)}</td>
                                    <td className="r px-3 py-2 text-right tabular-nums text-green-700">{amount(credit)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="r px-3 py-2 text-right">Balance (LKR)</td>
                                    <td className={`r px-3 py-2 text-right tabular-nums ${debit - credit > 0.005 ? 'text-red-700' : 'text-green-700'}`}>{balanceText(debit - credit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
                <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={printBill}><Printer className="mr-2 h-4 w-4" /> Print bill</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
