import { PROPERTY_INFO } from '@/lib/property-info';

// Printable A4 guest document used by the Front Desk: the guest folio (bill
// before payment) and the receipt (after settlement or for a past bill).
// All amounts are in LKR.

export type InvoiceLine = {
    category: string;
    description: string;
    detail?: string;
    subLines?: { label: string; amount: number }[];
    amount: number;
};

export type InvoicePayment = {
    date?: string | null;
    label: string;
    method?: string | null;
    amount: number;
};

export type GuestInvoiceProps = {
    title: string;
    status: 'PAID' | 'BALANCE DUE';
    documentNumber: string;
    issuedAt: string;
    guest: { name: string; phone?: string | null; email?: string | null; idNumber?: string | null; address?: string | null };
    stay?: { checkIn?: string | null; checkOut?: string | null; rooms?: string | null };
    lines: InvoiceLine[];
    // Payments received before this document (deposits, earlier bills).
    payments: InvoicePayment[];
    totalCharges: number;
    // Payment taken with this document (settlement at the Front Desk).
    settlement?: { method: string; amount: number; cashReceived?: number | null; change?: number | null } | null;
    balanceDue: number;
    notes?: string[];
};

const money = (value: number) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const formatDateTime = (value?: string | null) => value
    ? new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
const methodLabel = (method?: string | null) => method ? method.replace('_', ' ').replace(/^\w/, letter => letter.toUpperCase()) : '';

export function GuestInvoice(props: GuestInvoiceProps) {
    const { title, status, documentNumber, issuedAt, guest, stay, lines, payments, totalCharges, settlement, balanceDue, notes = [] } = props;
    const categories = Array.from(new Set(lines.map(line => line.category)));
    const paymentsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const nights = stay?.checkIn && stay?.checkOut
        ? Math.max(0, Math.round((new Date(stay.checkOut.slice(0, 10)).getTime() - new Date(stay.checkIn.slice(0, 10)).getTime()) / 86400000))
        : null;

    return (
        <div className="mx-auto max-w-[800px] bg-white p-8 text-[12px] leading-snug text-gray-900">
            {/* Header */}
            <div className="flex items-start justify-between border-b-4 border-green-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-wide text-green-900">{PROPERTY_INFO.name}</h1>
                    <p className="mt-1 text-gray-600">{PROPERTY_INFO.address}</p>
                    <p className="text-gray-600">Tel: {PROPERTY_INFO.phones.join(' / ')}</p>
                    <p className="text-gray-600">{PROPERTY_INFO.email} · {PROPERTY_INFO.website}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold uppercase tracking-widest">{title}</h2>
                    <p className="mt-1"><span className="text-gray-500">No:</span> <span className="font-mono font-semibold">{documentNumber}</span></p>
                    <p><span className="text-gray-500">Date:</span> {formatDateTime(issuedAt)}</p>
                    <p className={`mt-2 inline-block rounded border-2 px-3 py-0.5 text-sm font-bold tracking-widest ${status === 'PAID' ? 'border-green-700 text-green-700' : 'border-red-700 text-red-700'}`}>
                        {status}
                    </p>
                </div>
            </div>

            {/* Guest and stay */}
            <div className="mt-5 grid grid-cols-2 gap-6">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Guest</p>
                    <p className="mt-1 text-sm font-semibold">{guest.name}</p>
                    {guest.idNumber && <p className="text-gray-600">ID / Passport: {guest.idNumber}</p>}
                    {guest.phone && <p className="text-gray-600">{guest.phone}</p>}
                    {guest.email && <p className="text-gray-600">{guest.email}</p>}
                    {guest.address && <p className="text-gray-600">{guest.address}</p>}
                </div>
                {stay && (stay.checkIn || stay.rooms) && (
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Stay</p>
                        {stay.checkIn && stay.checkOut && (
                            <p className="mt-1 text-sm font-semibold">{formatDate(stay.checkIn)} – {formatDate(stay.checkOut)}</p>
                        )}
                        {nights != null && <p className="text-gray-600">{nights} night{nights === 1 ? '' : 's'}</p>}
                        {stay.rooms && <p className="text-gray-600">{stay.rooms}</p>}
                    </div>
                )}
            </div>

            {/* Charges */}
            <table className="mt-6 w-full border-collapse">
                <thead>
                    <tr className="border-y-2 border-gray-800 text-left text-[10px] uppercase tracking-wider">
                        <th className="py-2 pr-2">Description</th>
                        <th className="w-36 py-2 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {categories.map(category => (
                        <CategoryRows key={category} category={category} lines={lines.filter(line => line.category === category)} />
                    ))}
                    {lines.length === 0 && (
                        <tr><td colSpan={2} className="py-4 text-center text-gray-500">No charges.</td></tr>
                    )}
                </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
                <div className="w-80">
                    <Row label="Total charges" value={money(totalCharges)} strong />
                    {payments.length > 0 && (
                        <div className="mt-2 border-t pt-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Payments received</p>
                            {payments.map((payment, index) => (
                                <div key={index} className="flex justify-between gap-3 py-0.5 text-gray-700">
                                    <span>
                                        {[formatDate(payment.date), payment.label, methodLabel(payment.method)].filter(Boolean).join(' · ')}
                                    </span>
                                    <span className="whitespace-nowrap">-{money(payment.amount)}</span>
                                </div>
                            ))}
                            {payments.length > 1 && <Row label="Total received" value={`-${money(paymentsTotal)}`} />}
                        </div>
                    )}
                    {settlement && (
                        <div className="mt-2 border-t pt-2">
                            <Row label={`Paid now (${methodLabel(settlement.method)})`} value={`-${money(settlement.amount)}`} strong />
                            {settlement.cashReceived != null && settlement.cashReceived > 0 && (
                                <>
                                    <Row label="Cash received" value={money(settlement.cashReceived)} />
                                    <Row label="Change" value={money(settlement.change || 0)} />
                                </>
                            )}
                        </div>
                    )}
                    <div className={`mt-2 flex justify-between border-y-2 border-gray-800 py-2 text-base font-bold ${balanceDue > 0.009 ? 'text-red-700' : 'text-green-800'}`}>
                        <span>{balanceDue > 0.009 ? 'Balance Due' : 'Balance'}</span>
                        <span>{money(Math.max(0, balanceDue))}</span>
                    </div>
                </div>
            </div>

            {notes.length > 0 && (
                <div className="mt-4 space-y-0.5 text-[10px] text-gray-500">
                    {notes.map((note, index) => <p key={index}>{note}</p>)}
                </div>
            )}

            {/* Signatures */}
            <div className="mt-14 grid grid-cols-2 gap-16 text-center text-[11px] text-gray-600">
                <div className="border-t border-gray-400 pt-1">Guest Signature</div>
                <div className="border-t border-gray-400 pt-1">Front Desk</div>
            </div>

            <div className="mt-10 border-t pt-3 text-center text-[11px] text-gray-500">
                <p className="font-semibold text-gray-700">Thank you for staying with us at {PROPERTY_INFO.name}.</p>
                <p>{PROPERTY_INFO.address} · {PROPERTY_INFO.phones[0]} · {PROPERTY_INFO.email}</p>
            </div>
        </div>
    );
}

function CategoryRows({ category, lines }: { category: string; lines: InvoiceLine[] }) {
    return (
        <>
            <tr>
                <td colSpan={2} className="pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-green-900">{category}</td>
            </tr>
            {lines.map((line, index) => (
                <tr key={index} className="border-b border-gray-200 align-top">
                    <td className="py-1.5 pr-2">
                        <p className="font-medium">{line.description}</p>
                        {line.detail && <p className="text-[11px] text-gray-500">{line.detail}</p>}
                        {line.subLines && line.subLines.length > 0 && (
                            <div className="mt-0.5 space-y-0.5 pl-3 text-[11px] text-gray-600">
                                {line.subLines.map((subLine, subIndex) => (
                                    <div key={subIndex} className="flex justify-between gap-4">
                                        <span>{subLine.label}</span>
                                        <span className="whitespace-nowrap">{subLine.amount < 0 ? '-' : ''}{money(Math.abs(subLine.amount))}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </td>
                    <td className="py-1.5 text-right font-medium whitespace-nowrap">{money(line.amount)}</td>
                </tr>
            ))}
        </>
    );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className={`flex justify-between gap-3 py-0.5 ${strong ? 'font-semibold' : 'text-gray-700'}`}>
            <span>{label}</span>
            <span className="whitespace-nowrap">{value}</span>
        </div>
    );
}
