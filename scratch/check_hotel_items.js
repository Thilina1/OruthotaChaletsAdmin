const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { error: err1 } = await supabase.from('hotel_inventory_items').select('count').limit(1);
    console.log('hotel_inventory_items:', err1 ? err1.code : 'EXISTS');
}

check();
