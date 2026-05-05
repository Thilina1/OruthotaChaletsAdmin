const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const potentialCols = ['department_id', 'from_warehouse_id', 'to_warehouse_id', 'quantity', 'unit_id', 'category_id'];
    const results = [];
    for (const col of potentialCols) {
        const { error } = await supabase.from('inventory_requests').select(col).limit(0);
        results.push(`${col}: ${error ? 'MISSING' : 'OK'}`);
    }
    console.log(results.join('\n'));
}

check();
