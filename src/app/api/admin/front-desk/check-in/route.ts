import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { reservation_id, customer_name, phone, email, id_number, address, is_loyalty } = body;

        if (!reservation_id || !customer_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create or find customer
        let customer_id = null;
        
        // Try to find exact match
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customer_name.trim())
            .limit(1)
            .single();

        if (existingCustomer) {
            customer_id = existingCustomer.id;
            // Optionally update their details
            await supabase.from('customers').update({
                phone: phone || null,
                email: email || null,
                id_number: id_number || null,
                address: address || null
            }).eq('id', customer_id);
        } else {
            const { data: newCustomer, error: insertError } = await supabase
                .from('customers')
                .insert({ 
                    name: customer_name.trim(),
                    phone: phone || null,
                    email: email || null,
                    id_number: id_number || null,
                    address: address || null
                })
                .select('id')
                .single();
            if (insertError) throw insertError;
            customer_id = newCustomer.id;
        }

        // 2. Add to loyalty if checked
        if (is_loyalty && customer_id) {
            // Check if already in loyalty
            const { data: existingLoyalty } = await supabase
                .from('loyalty_customers')
                .select('id')
                .ilike('name', customer_name.trim())
                .limit(1)
                .single();
                
            if (!existingLoyalty) {
                const loyaltyId = Math.random().toString(36).substring(2, 8).toUpperCase();
                await supabase.from('loyalty_customers').insert({
                    loyalty_id: `LOYALTY-${loyaltyId}`,
                    name: customer_name.trim(),
                    phone_number: phone || null,
                    email: email || null
                });
            }
        }

        // 3. Update reservation status to checked-in and attach customer_id
        const { data: updatedReservation, error: updateError } = await supabase
            .from('reservations')
            .update({ 
                status: 'checked-in',
                customer_id: customer_id,
                check_in_time: new Date().toISOString()
            })
            .eq('id', reservation_id)
            .select()
            .single();

        if (updateError) throw updateError;

        return NextResponse.json({ reservation: updatedReservation, customer_id }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
