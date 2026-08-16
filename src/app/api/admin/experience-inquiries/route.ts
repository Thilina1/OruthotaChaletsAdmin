import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return NextResponse.json({ payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load payments.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    let customerId = body.customer_id ? String(body.customer_id) : null;
    let name = String(body.name || '').trim();
    let email = String(body.email || '').trim() || null;
    let phone = String(body.phone || '').trim() || null;

    if (customerId) {
      const { data: customer, error } = await supabase.from('customers').select('id,name,email,phone').eq('id', customerId).single();
      if (error || !customer) return NextResponse.json({ error: 'Selected customer was not found.' }, { status: 404 });
      name = customer.name;
      email = customer.email || email;
      phone = customer.phone || phone;
    }
    if (!name) return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });

    const inquiryPayload = {
      name,
      email,
      phone,
      subject: String(body.subject || '').trim() || null,
      message: String(body.message || '').trim() || null,
      inquiry_type: 'experience',
      experience_type: body.experience_type || 'culinary_tourism',
      status: 'pending',
    };
    let { data, error } = await supabase.from('contact_messages').insert({
      ...inquiryPayload,
      customer_id: customerId,
    }).select().single();

    // Allow inquiry creation before the customer-link migration is deployed.
    // Once the migration exists, the first insert above is used normally.
    if (error && /customer_id.*schema cache|column.*customer_id/i.test(error.message || '')) {
      const fallback = await supabase.from('contact_messages').insert(inquiryPayload).select().single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    return NextResponse.json({ inquiry: { ...data, customer_id: customerId } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create inquiry.' }, { status: 500 });
  }
}
