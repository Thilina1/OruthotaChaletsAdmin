const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // Try to fetch one row and see the keys
    const { data, error } = await supabase.from('inventory_requests').select('*').limit(1);
    if (error) {
        console.error("Error fetching rows:", error);
    } else if (data && data.length > 0) {
        console.log("Columns found in data:", Object.keys(data[0]));
    } else {
        console.log("No data found, trying to get column names via RPC or just returning empty.");
    }
    
    // Also try a query that explicitly lists columns to see if it fails
    const { error: error2 } = await supabase.from('inventory_requests').select('action_metadata').limit(1);
    if (error2) {
        console.error("\nError selecting action_metadata:", error2.message);
    } else {
        console.log("\naction_metadata column exists and is selectable.");
    }
}

checkSchema();
