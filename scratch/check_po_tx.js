const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*')
        .ilike('remarks', '%PO-20260507-001%');
    
    if (error) console.error(error);
    console.log(JSON.stringify(data, null, 2));
}

check();
