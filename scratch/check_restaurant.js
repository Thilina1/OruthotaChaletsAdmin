const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log("--- Warehouses ---");
    const { data: wh } = await supabase.from('inventory_warehouses').select('*');
    console.log(wh);

    console.log("\n--- Example Menu Item ---");
    const { data: menuItems } = await supabase.from('menu_items').select('*').limit(2);
    console.log(menuItems);

    console.log("\n--- Example Inventory Item ---");
    const { data: invItems } = await supabase.from('inventory_items').select('*').limit(2);
    console.log(invItems);

    console.log("\n--- Example Stock ---");
    const { data: stock } = await supabase.from('inventory_stock').select('*, batch:inventory_batches(*)').limit(2);
    console.log(stock);
}

check();
