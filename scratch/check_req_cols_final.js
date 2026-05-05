const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase.from('inventory_requests').select('*').limit(1);
    if (error) {
        console.log('Error:', error);
    } else if (data.length > 0) {
        console.log('Columns in inventory_requests:', Object.keys(data[0]));
    } else {
        console.log('Table exists but is empty. Trying to get columns via select...');
        const { error: selectError } = await supabase.from('inventory_requests').select('id, request_type, item_id, requested_quantity, status, requested_by, reviewed_by, notes, created_at, updated_at, purchase_order_id').limit(0);
        console.log('Select with purchase_order_id error:', selectError ? selectError.code : 'Success');
    }
}

check();
