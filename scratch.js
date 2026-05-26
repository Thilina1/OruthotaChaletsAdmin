const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
    const { data: loyaltyData, error: lError } = await supabase.from('loyalty_customers').select('*');
    if (lError) console.error("Loyalty error:", lError);
    console.log("Loyalty Customers:", loyaltyData?.length);
    const { data: customersData, error: cError } = await supabase.from('customers').select('*');
    if (cError) console.error("Customers error:", cError);
    console.log("Customers:", customersData?.length);
    
    // Migrate existing
    if (loyaltyData && loyaltyData.length > 0) {
        for (const lc of loyaltyData) {
            const { data: existing } = await supabase.from('customers').select('*').eq('phone', lc.mobile_number).single();
            if (!existing) {
                await supabase.from('customers').insert({ name: lc.name, phone: lc.mobile_number });
            }
        }
        console.log("Migration complete");
    }
}
run();
