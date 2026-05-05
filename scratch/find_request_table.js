const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const tables = [
        'inventory_requests',
        'hotel_inventory_requests',
        'stock_requests',
        'inventory_stock_requests',
        'transfer_requests',
        'inventory_transfers',
        'inventory_request_records'
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('count').limit(1);
        console.log(`${table}: ${error ? error.code : 'EXISTS'}`);
    }
}

check();
