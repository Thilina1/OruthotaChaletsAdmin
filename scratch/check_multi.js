const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { error: err1 } = await supabase.from('inventory_items').select('count').limit(1);
    const { error: err2 } = await supabase.from('inventory_requests').select('count').limit(1);
    const { error: err3 } = await supabase.from('inventory_warehouses').select('count').limit(1);
    
    console.log('inventory_items:', err1 ? err1.code : 'EXISTS');
    console.log('inventory_requests:', err2 ? err2.code : 'EXISTS');
    console.log('inventory_warehouses:', err3 ? err3.code : 'EXISTS');
}

check();
