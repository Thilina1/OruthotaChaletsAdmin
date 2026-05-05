const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase.from('inventory_transfers').select('*').limit(1);
    if (error) {
        console.log('Error:', error);
    } else if (data.length > 0) {
        console.log('Columns in inventory_transfers:', Object.keys(data[0]));
    } else {
        console.log('No data in inventory_transfers to check columns.');
    }
}

check();
