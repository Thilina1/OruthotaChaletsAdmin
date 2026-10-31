import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Invoice number for a service income record: the running number the
// database assigns (EXP-000001 for experiences, INV-000001 for other
// services). Records saved before that migration fall back to their id.
export function serviceInvoiceNumber(service: { id: string; service_type?: string | null; invoice_number?: string | null }) {
  if (service.invoice_number) return service.invoice_number;
  const prefix = service.service_type === 'Experience' ? 'EXP' : 'INV';
  return `${prefix}-${String(service.id).slice(0, 8).toUpperCase()}`;
}
