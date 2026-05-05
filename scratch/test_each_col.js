const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const cols = ['id', 'request_type', 'item_id', 'requested_quantity', 'status', 'requested_by', 'reviewed_by', 'notes', 'created_at', 'updated_at', 'action_metadata', 'brand', 'supplier_name', 'item_size'];
    const results = [];
    for (const col of cols) {
        const { error } = await supabase.from('inventory_requests').select(col).limit(0);
        results.push(`${col}: ${error ? 'MISSING' : 'OK'}`);
    }
    console.log(results.join('\n'));
}

check();
