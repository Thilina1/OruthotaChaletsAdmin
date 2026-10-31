import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { getExperiencePricingDefaults, saveExperiencePricingDefaults } from '@/lib/experience-pricing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
);

export async function GET() {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase.from('service_incomes').select('*').eq('service_type', 'Experience');
    if (error) throw error;
    const payments = (data || []).flatMap((income: any) => {
      const metadata = Array.isArray(income.line_items)
        ? income.line_items.find((line: any) => line.experience_inquiry_id)
        : null;
      const inquiryId = income.experience_inquiry_id || metadata?.experience_inquiry_id;
      return inquiryId ? [{
        inquiry_id: inquiryId,
        income_id: income.id,
        amount: Number(income.amount || 0),
        payment_status: income.payment_status || 'add_to_bill',
        payment_method: income.payment_method || null,
      }] : [];
    });
    return NextResponse.json({ payments, pricing_defaults: await getExperiencePricingDefaults(supabase) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load payments.' }, { status: 500 });
  }
}

const money = (value: number) => Math.round(value * 100) / 100;

type InquiryExperience = { name: string; people: number; rate: number | null };
type InquiryPricing = { service_charge_rate: number; tax_rate: number; other_charges: { name: string; amount: number }[] };

// Validates the customer, experiences and pricing sent by the inquiry form
// (shared by create and edit). Returns the columns to write, or an error.
async function parseInquiryBody(body: any): Promise<{ error: string; status: number } | { row: Record<string, any>; optional: Record<string, any> }> {
  let customerId = body.customer_id ? String(body.customer_id) : null;
  let name = String(body.name || '').trim();
  let email = String(body.email || '').trim() || null;
  let phone = String(body.phone || '').trim() || null;

  if (customerId) {
    const { data: customer, error } = await supabase.from('customers').select('id,name,email,phone').eq('id', customerId).single();
    if (error || !customer) return { error: 'Selected customer was not found.', status: 404 };
    name = customer.name;
    email = customer.email || email;
    phone = customer.phone || phone;
  }
  if (!name) return { error: 'Customer name is required.', status: 400 };

  // One or more requested experiences, each with its own number of people and rate per person.
  const experiences: InquiryExperience[] = Array.isArray(body.experiences)
    ? body.experiences
        .map((item: any) => ({
          name: String(item.name || '').trim(),
          people: Number(item.people),
          rate: item.rate === null || item.rate === undefined || item.rate === '' ? null : money(Number(item.rate)),
        }))
        .filter((item: InquiryExperience) => item.name)
    : [];
  if (experiences.some((item) => !Number.isInteger(item.people) || item.people < 1)) {
    return { error: 'Each experience needs at least 1 person.', status: 400 };
  }
  if (experiences.some((item) => item.rate !== null && (Number.isNaN(item.rate) || item.rate < 0))) {
    return { error: 'Enter a valid rate for each experience.', status: 400 };
  }
  const rawGuestCount = experiences.length > 0 ? Math.max(...experiences.map((item) => item.people)) : body.guest_count;
  const guestCount = rawGuestCount === null || rawGuestCount === undefined || rawGuestCount === '' ? null : Number(rawGuestCount);
  if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount < 1)) {
    return { error: 'Number of people must be at least 1.', status: 400 };
  }

  let pricing: InquiryPricing | null = null;
  if (body.pricing) {
    pricing = {
      service_charge_rate: Number(body.pricing.service_charge_rate) || 0,
      tax_rate: Number(body.pricing.tax_rate) || 0,
      other_charges: Array.isArray(body.pricing.other_charges)
        ? body.pricing.other_charges
            .map((item: any) => ({ name: String(item.name || '').trim(), amount: money(Number(item.amount) || 0) }))
            .filter((item: { name: string; amount: number }) => item.name && item.amount >= 0)
        : [],
    };
    if (pricing.service_charge_rate < 0 || pricing.tax_rate < 0) return { error: 'Service charge and tax cannot be negative.', status: 400 };
  }

  return {
    row: {
      name,
      email,
      phone,
      subject: String(body.subject || '').trim() || null,
      message: String(body.message || '').trim() || null,
      experience_type: experiences.length > 0 ? experiences.map((item) => item.name).join(', ') : (body.experience_type || 'culinary_tourism'),
    },
    // Columns from later migrations; dropped if the database does not have them yet.
    optional: {
      customer_id: customerId,
      guest_count: guestCount,
      experiences: experiences.length > 0 ? experiences : null,
      pricing,
    },
  };
}

const missingOptionalColumn = (error: any) =>
  error && /(customer_id|guest_count|experiences|pricing).*schema cache|column.*(customer_id|guest_count|experiences|pricing)/i.test(error.message || '');

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = await parseInquiryBody(await request.json());
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    const inquiryPayload = { ...parsed.row, inquiry_type: 'experience', status: 'pending' };
    let { data, error } = await supabase.from('contact_messages').insert({ ...inquiryPayload, ...parsed.optional }).select().single();

    // Allow inquiry creation before the later migrations are deployed.
    // Once they exist, the first insert above is used normally.
    if (missingOptionalColumn(error)) {
      const fallback = await supabase.from('contact_messages').insert(inquiryPayload).select().single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    if (parsed.optional.pricing) await saveExperiencePricingDefaults(supabase, parsed.optional.pricing);
    return NextResponse.json({ inquiry: { ...parsed.optional, ...data } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create inquiry.' }, { status: 500 });
  }
}

// Edits an inquiry's customer, experiences and pricing; the values stay until edited again.
export async function PUT(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Inquiry ID is required.' }, { status: 400 });
    const parsed = await parseInquiryBody(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    const { data, error } = await supabase
      .from('contact_messages')
      .update({ ...parsed.row, ...parsed.optional })
      .eq('id', id)
      .eq('inquiry_type', 'experience')
      .select()
      .single();
    if (missingOptionalColumn(error)) {
      return NextResponse.json({ error: 'Run the latest experience inquiry migrations before editing inquiries.' }, { status: 409 });
    }
    if (error) throw error;
    if (parsed.optional.pricing) await saveExperiencePricingDefaults(supabase, parsed.optional.pricing);
    return NextResponse.json({ inquiry: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update inquiry.' }, { status: 500 });
  }
}
