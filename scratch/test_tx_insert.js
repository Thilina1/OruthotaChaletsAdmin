const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([{
            item_id: '00000000-0000-0000-0000-000000000000',
            transaction_type: 'receive',
            quantity: 1,
            remarks: 'Test metadata insert',
            unit_price: 100,
            batch_number: 'TEST',
            supplier: 'TEST',
            item_size: 'TEST',
            brand: 'TEST'
        }])
        .select();
    
    if (error) {
        console.log("INSERT FAILED: " + error.message + " (" + error.code + ")");
    } else {
        console.log("INSERT SUCCESS");
        // Delete the test row
        await supabase.from('inventory_transactions').delete().eq('id', data[0].id);
    }
}

check();
