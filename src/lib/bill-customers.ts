import type { SupabaseClient } from '@supabase/supabase-js';

// Customer records whose charges belong on one guest's Front Desk bill.
//
// Chalet bookings are matched to guests by name (they don't store a
// customer id), so when the same guest has more than one customer record
// with that name, restaurant orders and services added to the bill can sit on
// any of them. While the guest has an active chalet stay, every same-name
// record is billed together; otherwise only the customer's own record is.
export async function billCustomerIds(client: SupabaseClient, customer: { id: string; name?: string | null }): Promise<string[]> {
    const name = customer.name?.trim();
    if (!name) return [customer.id];

    const { data: stays } = await client
        .from('chalet_bookings')
        .select('id')
        .ilike('customer_name', name)
        .in('status', ['checked_in', 'confirmed'])
        .limit(1);
    if (!stays?.length) return [customer.id];

    const { data: sameName } = await client.from('customers').select('id').ilike('name', name);
    return Array.from(new Set([customer.id, ...(sameName || []).map((row: any) => row.id)]));
}
