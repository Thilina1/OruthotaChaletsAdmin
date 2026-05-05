const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLinks() {
    console.log("--- WAREHOUSES ---");
    const { data: whs, error: whe } = await supabase.from('inventory_warehouses').select('id, name, department_id');
    if (whe) console.error(whe);
    else console.log(whs);

    console.log("\n--- DEPARTMENTS ---");
    const { data: depts, error: de } = await supabase.from('inventory_departments').select('id, name');
    if (de) console.error(de);
    else console.log(depts);
}

checkLinks();
