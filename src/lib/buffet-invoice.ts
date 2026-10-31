import type { BuffetPackage, TableBooking } from '@/lib/types';

// Shared by the printed buffet invoice and the invoice email, so both show
// the same number and lines. All amounts are in LKR.

export function buffetInvoiceNumber(booking: Pick<TableBooking, 'id' | 'created_at'>) {
    const year = booking.created_at ? new Date(booking.created_at).getFullYear() : new Date().getFullYear();
    return `BB-${year}-${booking.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function buffetInvoiceLines(booking: TableBooking) {
    const guests = Math.max(1, Number(booking.guests) || 1);
    const perGuest = Number(booking.price_per_guest || 0);
    const meal = booking.meal_type ? booking.meal_type.charAt(0).toUpperCase() + booking.meal_type.slice(1) : 'Buffet';
    const lines: { description: string; detail?: string; quantity?: number; rate?: number; amount: number }[] = [];

    if (booking.package_id && Number(booking.total_amount || 0) > 0) {
        lines.push({
            description: booking.buffet_packages?.name || 'Buffet package',
            detail: `${meal} buffet`,
            quantity: guests,
            rate: perGuest,
            amount: perGuest * guests,
        });
        if (Number(booking.service_charge_amount || 0) > 0) {
            lines.push({ description: 'Service charge', amount: Number(booking.service_charge_amount) });
        }
        if (Number(booking.other_charge_amount || 0) > 0) {
            lines.push({ description: 'Other charges', amount: Number(booking.other_charge_amount) });
        }
        if (Number(booking.vat_amount || 0) > 0) {
            lines.push({ description: 'VAT', amount: Number(booking.vat_amount) });
        }
    }

    return { lines, guests, meal, total: Number(booking.total_amount || 0) };
}

export function formatLkr(value: number) {
    return `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBookingDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// Same calc order as the Buffet Packages preview: service charge and each
// named "other charge" apply to the subtotal, then VAT applies on top of all of it.
export function calcPackageCharges(pkg: BuffetPackage, guests: number) {
  const perGuest = (pkg.buffet_menu_items || []).filter(i => i.is_active).reduce((sum, i) => sum + Number(i.price || 0), 0);
  const subtotal = perGuest * guests;
  const serviceChargeAmount = subtotal * (Number(pkg.service_charge_rate) / 100);
  const otherChargeBreakdown = (pkg.other_charges || []).filter(c => c.name.trim()).map(c => ({
    ...c,
    amount: c.type === 'percentage' ? subtotal * (Number(c.value) / 100) : Number(c.value),
  }));
  const otherChargeAmount = otherChargeBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const vatBase = subtotal + serviceChargeAmount + otherChargeAmount;
  const vatAmount = vatBase * (Number(pkg.vat_rate) / 100);
  const total = vatBase + vatAmount;
  return { perGuest, subtotal, serviceChargeAmount, otherChargeBreakdown, otherChargeAmount, vatAmount, total };
}
