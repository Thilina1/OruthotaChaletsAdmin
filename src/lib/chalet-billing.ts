// Chalet booking amounts used by the Front Desk bill and settlement. All
// results are in LKR, which is what front desk payments are recorded in.

type ChaletRateRow = {
    package_id?: string | null;
    room_category_id?: string | null;
    occupancy_type_id?: string | null;
    usd_to_lkr_rate?: number | string | null;
};

export function chaletBillCurrency(booking: any): 'LKR' | 'USD' {
    if (booking?.currency === 'USD' || booking?.currency === 'LKR') return booking.currency;
    return booking?.nationality === 'Non Sri Lankan' ? 'USD' : 'LKR';
}

function allocationValue(allocation: Record<string, any> | null | undefined, camelKey: string, snakeKey: string) {
    return allocation?.[camelKey] ?? allocation?.[snakeKey] ?? '';
}

// USD to LKR rate for a booking: the rate locked on it when it was made
// (usd_to_lkr_rate), else the current Chalet Rates value.
export function chaletExchangeRate(booking: any, rates: ChaletRateRow[] = []) {
    const locked = Number(booking?.usd_to_lkr_rate || 0);
    if (locked > 0) return locked;
    const allocation = Array.isArray(booking?.room_allocations) ? booking.room_allocations[0] : null;
    const packageId = booking?.package_id || allocationValue(allocation, 'packageId', 'package_id') || '';
    const categoryId = booking?.room_category_id || allocationValue(allocation, 'roomCategoryId', 'room_category_id') || '';
    const rate = rates.find(item =>
        item.package_id === packageId &&
        !item.occupancy_type_id &&
        (item.room_category_id || '') === (categoryId || '')
    ) || rates.find(item =>
        item.package_id === packageId &&
        !item.occupancy_type_id &&
        !item.room_category_id
    );
    return Number(rate?.usd_to_lkr_rate || 0);
}

// Converts an amount in the booking's currency to LKR.
export function chaletAmountInLkr(booking: any, amount: unknown, rates: ChaletRateRow[] = []) {
    const value = Number(amount || 0);
    const exchangeRate = chaletExchangeRate(booking, rates);
    return chaletBillCurrency(booking) === 'USD' && exchangeRate > 0 ? value * exchangeRate : value;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// Chalet Bill Settings (app_settings 'chalet_bill_settings', edited under
// Chalet Rates → Bill Settings). Bookings lock their own copy of these when
// made, so bills use the booking's values; the optional settings argument
// below is only for working out a price for a new booking.
export type ChaletBillSettings = {
    service_charge_pct?: number;
    service_charge_currency?: 'LKR' | 'USD' | 'both';
    vat_pct?: number;
    vat_currency?: 'LKR' | 'USD' | 'both';
    sscl_pct?: number;
    sscl_currency?: 'LKR' | 'USD' | 'both';
};

export async function loadChaletBillSettings(client: any): Promise<ChaletBillSettings | null> {
    const { data, error } = await client.from('app_settings').select('value').eq('key', 'chalet_bill_settings').maybeSingle();
    if (error || !data?.value || typeof data.value !== 'object') return null;
    return data.value as ChaletBillSettings;
}

// The bill in the booking's own currency, from the prices locked on the
// booking: coupon off the subtotal, then service charge / VAT / SSCL only
// where the booking's saved settings apply them to the guest's currency.
// (The database's grand_total column only adds the service charge, so it is
// not used.)
export function chaletBillLines(booking: any, settings?: ChaletBillSettings | null) {
    const currency = chaletBillCurrency(booking);
    const nights = bookingNights(booking);
    const ratePerNight = Number(booking?.rate_per_night || 0);
    const storedSubtotal = Number(booking?.subtotal);
    const subtotal = Number.isFinite(storedSubtotal) && booking?.subtotal != null ? storedSubtotal : ratePerNight * nights;
    const couponDiscount = Math.min(subtotal, Math.max(0, Number(booking?.coupon_discount_amount || 0)));
    const discounted = Math.max(0, subtotal - couponDiscount);
    const charges = [
        { label: 'Service Charge', pct: Number(settings?.service_charge_pct ?? booking?.service_charge_pct ?? 0), appliesTo: settings?.service_charge_currency ?? booking?.service_charge_currency },
        { label: 'VAT', pct: Number(settings?.vat_pct ?? booking?.vat_pct ?? 0), appliesTo: settings?.vat_currency ?? booking?.vat_currency },
        { label: 'SSCL', pct: Number(settings?.sscl_pct ?? booking?.sscl_pct ?? 0), appliesTo: settings?.sscl_currency ?? booking?.sscl_currency },
    ]
        .filter(charge => charge.pct > 0 && chargeApplies(charge.appliesTo, currency))
        .map(charge => ({ label: charge.label, pct: charge.pct, appliesTo: String(charge.appliesTo || 'both'), amount: discounted * charge.pct / 100 }));
    const total = discounted + charges.reduce((sum, charge) => sum + charge.amount, 0);
    return { currency, nights, ratePerNight, subtotal, couponDiscount, charges, total };
}

// chaletBillLines for showing a bill: when the booking form saved the LKR
// total, the lines are scaled to it so they always add up to the same total
// shown everywhere else (older bookings may store prices in a different unit).
// Amounts are in the booking currency.
export function chaletBillLinesForDisplay(booking: any, rates: ChaletRateRow[] = [], settings?: ChaletBillSettings | null) {
    const lines = chaletBillLines(booking, settings);
    // With Bill Settings the bill is always worked out from them.
    if (settings) return lines;
    const savedLkr = Number(booking?.bill_total_lkr || 0);
    if (!(savedLkr > 0) || !(lines.total > 0)) return lines;
    const exchangeRate = chaletExchangeRate(booking, rates);
    const total = lines.currency === 'USD' && exchangeRate > 0 ? savedLkr / exchangeRate : savedLkr;
    const scale = total / lines.total;
    return {
        ...lines,
        ratePerNight: lines.ratePerNight * scale,
        subtotal: lines.subtotal * scale,
        couponDiscount: lines.couponDiscount * scale,
        charges: lines.charges.map(charge => ({ ...charge, amount: charge.amount * scale })),
        total,
    };
}

// Full bill in LKR. bill_total_lkr is saved by the booking form; other
// bookings are calculated from their prices and charge settings.
export function chaletTotalLkr(booking: any, rates: ChaletRateRow[] = [], settings?: ChaletBillSettings | null) {
    if (settings) return round2(chaletAmountInLkr(booking, chaletBillLines(booking, settings).total, rates));
    const saved = Number(booking?.bill_total_lkr || 0);
    if (saved > 0) return round2(saved);
    return round2(chaletAmountInLkr(booking, chaletBillLines(booking).total, rates));
}

// Already paid in LKR: payments taken in the booking form (amount_paid) or a
// website (PayHere) payment, which is recorded in its own currency.
export function chaletPaidLkr(booking: any, rates: ChaletRateRow[] = []) {
    const recorded = Math.max(0, Number(booking?.amount_paid || 0));
    const onlineAmount = Number(booking?.payhere_amount || 0);
    if (onlineAmount <= 0) return round2(recorded);
    const onlineCurrency = String(booking?.payhere_currency || chaletBillCurrency(booking)).toUpperCase();
    const exchangeRate = chaletExchangeRate(booking, rates);
    const onlineLkr = onlineCurrency === 'USD' ? (exchangeRate > 0 ? onlineAmount * exchangeRate : 0) : onlineAmount;
    return round2(Math.max(recorded, onlineLkr));
}

// What the front desk still has to collect for this booking, in LKR.
export function chaletOutstandingLkr(booking: any, rates: ChaletRateRow[] = [], settings?: ChaletBillSettings | null) {
    if (booking?.payment_status === 'paid' && !(Number(booking?.payment_balance_amount || 0) > 0)) return 0;
    const balance = chaletTotalLkr(booking, rates, settings) - chaletPaidLkr(booking, rates);
    return balance > 0.009 ? round2(balance) : 0;
}

function chargeApplies(chargeCurrency: unknown, billCurrency: 'LKR' | 'USD') {
    const value = String(chargeCurrency || 'both');
    return value === 'both' || value === billCurrency;
}

function bookingNights(booking: any) {
    const stored = Number(booking?.total_nights ?? booking?.nights ?? 0);
    if (stored > 0) return stored;
    if (!booking?.check_in_date || !booking?.check_out_date) return 0;
    const diff = new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime();
    return Math.max(0, Math.round(diff / 86400000));
}

export type ChaletBillBreakdown = {
    nights: number;
    rate_per_night: number;
    subtotal: number;
    coupon_code: string | null;
    coupon_discount: number;
    charges: { label: string; pct: number; amount: number }[];
    total: number;
};

// Line-by-line bill in LKR (see chaletBillLines), scaled so the lines add up
// to the bill total in LKR.
export function chaletBillBreakdown(booking: any, rates: ChaletRateRow[] = [], settings?: ChaletBillSettings | null): ChaletBillBreakdown | null {
    const lines = chaletBillLines(booking, settings);
    const totalLkr = chaletTotalLkr(booking, rates, settings);
    if (!(lines.total > 0) || !(totalLkr > 0)) return null;
    const toLkr = totalLkr / lines.total;
    return {
        nights: lines.nights,
        rate_per_night: round2(lines.ratePerNight * toLkr),
        subtotal: round2(lines.subtotal * toLkr),
        coupon_code: booking?.coupon_code || null,
        coupon_discount: round2(lines.couponDiscount * toLkr),
        charges: lines.charges.map(charge => ({ label: charge.label, pct: charge.pct, amount: round2(charge.amount * toLkr) })),
        total: round2(totalLkr),
    };
}

export type ChaletPaymentHistoryItem = {
    id: string;
    paid_at: string | null;
    payment_method: string | null;
    amount: number;
    account_name: string | null;
    recorded_by: string | null;
    label: string;
};

// Every payment made on a booking, in LKR: rows from chalet_booking_payments,
// plus one entry for any paid amount not covered by them (a website payment,
// or a payment taken before payments were recorded one by one).
export function chaletPaymentHistory(booking: any, paymentRows: any[] = [], rates: ChaletRateRow[] = []): ChaletPaymentHistoryItem[] {
    const payments: ChaletPaymentHistoryItem[] = paymentRows.map(payment => ({
        id: payment.id,
        paid_at: payment.paid_at || null,
        payment_method: payment.payment_method || null,
        amount: Number(payment.amount || 0),
        account_name: payment.account?.name || null,
        recorded_by: payment.user?.name || null,
        label: 'Booking payment',
    }));
    const listed = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const unlisted = round2(chaletPaidLkr(booking, rates) - listed);
    if (unlisted > 0.009) {
        const paidOnline = Number(booking?.payhere_amount || 0) > 0 || Boolean(booking?.online_account_transaction_id);
        payments.unshift({
            id: `${booking?.id}-earlier`,
            paid_at: paidOnline ? booking?.payhere_received_at || null : null,
            payment_method: paidOnline ? 'online' : booking?.payment_method || null,
            amount: unlisted,
            account_name: null,
            recorded_by: null,
            label: paidOnline ? 'Website payment' : 'Earlier payment',
        });
    }
    return payments;
}
