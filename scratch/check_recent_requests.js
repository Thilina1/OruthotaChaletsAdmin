const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentRequests() {
    const { data: reqs, error } = await supabase
        .from('inventory_requests')
        .select('id, action_metadata, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error(error);
        return;
    }

    console.log("RECENT REQUESTS:");
    reqs.forEach(r => {
        console.log(`\nID: ${r.id}`);
        console.log(`Created At: ${r.created_at}`);
        console.log(`Metadata:`, JSON.stringify(r.action_metadata, null, 2));
    });
}

checkRecentRequests();
