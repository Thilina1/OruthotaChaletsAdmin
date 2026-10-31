import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { saveExperiencePricingDefaults } from '@/lib/experience-pricing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
);

const money = (value: number) => Math.round(value * 100) / 100;

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const inquiryId = new URL(request.url).searchParams.get('inquiry_id');
    if (!inquiryId) return NextResponse.json({ error: 'Inquiry ID is required.' }, { status: 400 });
    const { data, error } = await supabase
      .from('service_incomes')
      .select('*')
      .eq('service_type', 'Experience');
    if (error) throw error;
    const income = (data || []).find((item: any) =>
      Array.isArray(item.line_items) && item.line_items.some((line: any) => line.experience_inquiry_id === inquiryId)
    ) || null;
    if (income) {
      const metadata = income.line_items.find((line: any) => line.experience_inquiry_id === inquiryId);
      income.pricing_breakdown = metadata?.pricing_breakdown || null;
    }
    return NextResponse.json({ income });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load experience billing.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const inquiryId = String(body.inquiry_id || '');
    // One or more experiences, each with its own headcount and rate per person.
    // Older clients send a single people / price_per_person pair instead.
    const experiences: { name: string; people: number; rate: number }[] = Array.isArray(body.experiences)
      ? body.experiences.map((item: any) => ({
          name: String(item.name || '').trim(),
          people: Number(item.people),
          rate: money(Number(item.rate) || 0),
        }))
      : [];
    if (experiences.some((item) => !item.name || !Number.isInteger(item.people) || item.people < 1 || item.rate < 0)) {
      return NextResponse.json({ error: 'Each experience needs a name, at least one person, and a valid rate.' }, { status: 400 });
    }
    const people = experiences.length > 0 ? Math.max(...experiences.map((item) => item.people)) : Number(body.people);
    const hasPricePerPerson = body.price_per_person !== null && body.price_per_person !== undefined && body.price_per_person !== '';
    const pricePerPerson = hasPricePerPerson ? Number(body.price_per_person) : 0;
    const serviceChargeRate = Number(body.service_charge_rate || 0);
    const taxRate = Number(body.tax_rate || 0);
    const otherCharges = Array.isArray(body.other_charges)
      ? body.other_charges
          .map((item: any) => ({ name: String(item.name || '').trim(), amount: money(Number(item.amount) || 0) }))
          .filter((item: { name: string; amount: number }) => item.name && item.amount >= 0)
      : [];
    const paymentStatus = body.payment_status === 'paid' ? 'paid' : 'add_to_bill';
    const paymentMethod = paymentStatus === 'paid' && ['cash', 'card'].includes(body.payment_method) ? body.payment_method : null;

    if (!inquiryId || !Number.isInteger(people) || people < 1 || (hasPricePerPerson && pricePerPerson < 0) || serviceChargeRate < 0 || taxRate < 0) {
      return NextResponse.json({ error: 'Enter valid pricing and guest details.' }, { status: 400 });
    }

    const { data: inquiry, error: inquiryError } = await supabase
      .from('contact_messages')
      .select('*')
      .eq('id', inquiryId)
      .eq('inquiry_type', 'experience')
      .single();
    if (inquiryError || !inquiry) return NextResponse.json({ error: 'Experience inquiry not found.' }, { status: 404 });

    let customerId = body.customer_id ? String(body.customer_id) : (inquiry.customer_id || null);
    const customerName = String(body.customer_name || inquiry.name || '').trim();
    if (!customerName) return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });

    if (!customerId) {
      let customerQuery = supabase.from('customers').select('id').limit(1);
      if (inquiry.email) customerQuery = customerQuery.ilike('email', inquiry.email.trim());
      else if (inquiry.phone) customerQuery = customerQuery.ilike('phone', inquiry.phone.trim());
      else customerQuery = customerQuery.ilike('name', customerName);
      const { data: matches } = await customerQuery;
      customerId = matches?.[0]?.id || null;
    }

    if (!customerId) {
      const { data: customer, error } = await supabase.from('customers').insert({
        name: customerName,
        email: inquiry.email || null,
        phone: inquiry.phone || null,
      }).select('id').single();
      if (error) throw error;
      customerId = customer.id;
    }

    if (!inquiry.customer_id && customerId) {
      await supabase.from('contact_messages').update({ customer_id: customerId }).eq('id', inquiryId);
    }

    const experienceName = experiences.length > 0
      ? experiences.map((item) => item.name).join(', ')
      : String(body.experience_name || inquiry.experience_type || inquiry.subject || 'Experience');
    const baseAmount = experiences.length > 0
      ? money(experiences.reduce((sum, item) => sum + item.people * item.rate, 0))
      : money(people * pricePerPerson);
    const serviceCharge = money(baseAmount * serviceChargeRate / 100);
    const taxBase = baseAmount + serviceCharge;
    const tax = money(taxBase * taxRate / 100);
    const total = money(taxBase + tax + otherCharges.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0));
    const pricingBreakdown = {
      people,
      price_per_person: experiences.length === 1 ? experiences[0].rate : experiences.length > 1 ? null : hasPricePerPerson ? pricePerPerson : null,
      ...(experiences.length > 0 ? { experiences } : {}),
      base_amount: baseAmount, service_charge_rate: serviceChargeRate, service_charge: serviceCharge, tax_rate: taxRate, tax, other_charges: otherCharges, total };
    const experienceLines = experiences.length > 0
      ? experiences.map((item) => ({
          description: `${item.name} — ${item.people} ${item.people === 1 ? 'person' : 'people'} × LKR ${item.rate.toFixed(2)}`,
          amount: money(item.people * item.rate),
        }))
      : null;
    const lineItems = [
      ...(experienceLines ?? []),
      ...(!experienceLines && hasPricePerPerson ? [{ description: `${experienceName} — ${people} ${people === 1 ? 'person' : 'people'} × LKR ${pricePerPerson.toFixed(2)}`, amount: baseAmount }] : []),
      ...(serviceChargeRate > 0 ? [{ description: `Service charge (${serviceChargeRate}%)`, amount: serviceCharge }] : []),
      ...(taxRate > 0 ? [{ description: `Tax (${taxRate}%)`, amount: tax }] : []),
      ...otherCharges.map((item: { name: string; amount: number }) => ({ description: item.name, amount: item.amount })),
    ];
    const storedLineItems = lineItems.length > 0 ? lineItems : [{ description: experienceName, amount: 0 }];
    storedLineItems[0] = { ...storedLineItems[0], experience_inquiry_id: inquiryId, pricing_breakdown: pricingBreakdown } as any;

    const payload = {
      description: experienceName,
      amount: total,
      service_type: 'Experience',
      date: new Date().toISOString().slice(0, 10),
      customer_name: customerName,
      customer_id: customerId,
      // Checked-in guest's room, so the charge shows against the room on the guest bill.
      ...(body.room_number !== undefined ? { room_number: String(body.room_number || '').trim() || null } : {}),
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      line_items: storedLineItems,
    };

    const { data: existingIncomes, error: lookupError } = await supabase.from('service_incomes').select('id,line_items').eq('service_type', 'Experience');
    if (lookupError) throw lookupError;
    const existing = (existingIncomes || []).find((item: any) =>
      Array.isArray(item.line_items) && item.line_items.some((line: any) => line.experience_inquiry_id === inquiryId)
    );
    const saveQuery = existing
      ? supabase.from('service_incomes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : supabase.from('service_incomes').insert(payload);
    const { data: income, error: incomeError } = await saveQuery.select().single();
    if (incomeError) throw incomeError;

    const { error: statusError } = await supabase.from('contact_messages').update({ status: 'confirmed' }).eq('id', inquiryId);
    if (statusError) throw statusError;

    // Keep the inquiry in step with the last saved bill, so Edit Inquiry shows
    // the same experiences, headcounts, rates and charges.
    const inquiryPricing = { service_charge_rate: serviceChargeRate, tax_rate: taxRate, other_charges: otherCharges };
    const inquiryUpdate: Record<string, any> = { pricing: inquiryPricing };
    if (experiences.length > 0) {
      inquiryUpdate.experiences = experiences;
      inquiryUpdate.experience_type = experiences.map((item) => item.name).join(', ');
      inquiryUpdate.guest_count = people;
    }
    const { error: syncError } = await supabase.from('contact_messages').update(inquiryUpdate).eq('id', inquiryId);
    // Before the inquiry pricing migrations run, the bill still saves without the sync.
    if (syncError) console.error('Syncing experience inquiry from bill failed:', syncError);
    await saveExperiencePricingDefaults(supabase, { service_charge_rate: serviceChargeRate, tax_rate: taxRate, other_charges: otherCharges });

    return NextResponse.json({ income, inquiry: syncError ? null : inquiryUpdate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add experience to bill.' }, { status: 500 });
  }
}
