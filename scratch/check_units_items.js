const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { error: err1 } = await supabase.from('inventory_items').select('id, name, code').limit(0);
    const { error: err2 } = await supabase.from('inventory_units').select('name').limit(0);
    
    console.log('inventory_items (id, name, code):', err1 ? err1.code : 'OK');
    console.log('inventory_units (name):', err2 ? err2.code : 'OK');
}

check();
