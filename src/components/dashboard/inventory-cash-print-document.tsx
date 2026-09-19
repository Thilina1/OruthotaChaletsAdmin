'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PrintableRequest = {
    request_number?: string;
    purpose?: string | null;
    status?: string | null;
    requested_amount?: number | null;
    approved_amount?: number | null;
    issued_amount?: number | null;
    spent_amount?: number | null;
    returned_amount?: number | null;
    additional_issued_amount?: number | null;
    notes?: string | null;
    rejection_reason?: string | null;
    created_at?: string | null;
    requested_by_user?: { name?: string | null; department?: string | null } | null;
    approved_by_user?: { name?: string | null } | null;
    issued_by_user?: { name?: string | null } | null;
    liability_settled_by?: string | null;
    purchase_order?: { po_number?: string | null; supplier_name?: string | null; payment_type?: string | null } | null;
};

const money = (value: number | null | undefined) => value == null ? '—' : `Rs ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value?: string | null) => value ? new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function InventoryCashPrintButton({ request, label = 'Print Document' }: { request: PrintableRequest; label?: string }) {
    const print = () => requestAnimationFrame(() => window.print());
    return (
        <>
            <Button type="button" variant="outline" onClick={print} className="print:hidden"><Printer className="mr-2 h-4 w-4" />{label}</Button>
            <div id="print-area" className="hidden print:block bg-white p-8 text-black">
                <header className="border-b-2 border-black pb-4 text-center"><h1 className="text-2xl font-bold">Oruthota Chalets</h1><p className="text-lg font-semibold">Inventory Cash Document</p><p className="mt-1 text-sm">Request No: {request.request_number || '—'} · Printed: {date(new Date().toISOString())}</p></header>
                <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <p><strong>Requested By:</strong> {request.requested_by_user?.name || '—'}</p><p><strong>Department:</strong> {request.requested_by_user?.department || '—'}</p>
                    <p><strong>Request Date:</strong> {date(request.created_at)}</p><p><strong>Status:</strong> {request.status || '—'}</p>
                    <p className="col-span-2"><strong>Purpose:</strong> {request.purpose || '—'}</p>
                    {request.purchase_order && <><p><strong>Purchase Order:</strong> {request.purchase_order.po_number || '—'}</p><p><strong>Supplier:</strong> {request.purchase_order.supplier_name || '—'}</p><p><strong>Payment Type:</strong> {request.purchase_order.payment_type || '—'}</p></>}
                </section>
                <table className="mt-6 w-full border-collapse text-sm"><tbody>{[['Requested Amount', money(request.requested_amount)], ['Approved Amount', money(request.approved_amount)], ['Total Issued', money((request.issued_amount || 0) + (request.additional_issued_amount || 0))], ['Spent Amount', money(request.spent_amount)], ['Returned Amount', money(request.returned_amount)]].map(([label, value]) => <tr key={label} className="border-b"><td className="px-3 py-2 font-semibold">{label}</td><td className="px-3 py-2 text-right">{value}</td></tr>)}</tbody></table>
                <section className="mt-6"><h2 className="border-b border-black pb-2 text-base font-bold">Action History</h2><table className="mt-2 w-full border-collapse text-sm"><tbody>
                    <tr className="border-b"><td className="px-3 py-2 font-semibold">Request Created By</td><td className="px-3 py-2">{request.requested_by_user?.name || '—'}</td></tr>
                    <tr className="border-b"><td className="px-3 py-2 font-semibold">Approved By</td><td className="px-3 py-2">{request.approved_by_user?.name || '—'}</td></tr>
                    <tr className="border-b"><td className="px-3 py-2 font-semibold">Cash Issued By</td><td className="px-3 py-2">{request.issued_by_user?.name || '—'}</td></tr>
                    <tr className="border-b"><td className="px-3 py-2 font-semibold">Settlement / Return Confirmed By</td><td className="px-3 py-2">{request.liability_settled_by || '—'}</td></tr>
                </tbody></table></section>
                {(request.notes || request.rejection_reason) && <p className="mt-5 whitespace-pre-wrap text-sm"><strong>Notes:</strong> {request.notes || request.rejection_reason}</p>}
                <div className="mt-24 grid grid-cols-2 gap-16 text-sm"><div><div className="border-t border-black pt-2">Requested / Received By</div><p className="mt-1">Name: {request.requested_by_user?.name || '________________'}</p><p>Date: __________________</p></div><div><div className="border-t border-black pt-2">Approved / Issued By</div><p className="mt-1">Name: {request.approved_by_user?.name || request.issued_by_user?.name || '________________'}</p><p>Date: __________________</p></div></div>
            </div>
        </>
    );
}
