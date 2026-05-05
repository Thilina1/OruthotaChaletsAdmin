
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('query_columns', { 
    table_to_check: 'hotel_inventory_products' 
  });
  
  if (error) {
    console.log("Checking columns via raw query (if rpc exists)...");
    const { data: cols, error: colErr } = await supabase
        .from('hotel_inventory_products')
        .select('*')
        .limit(1);
    
    if (colErr) {
        console.error("Failed to select from table:", colErr.message);
        return;
    }
    console.log("Columns found in first row:", Object.keys(cols[0] || {}));
  } else {
    console.log("Columns in hotel_inventory_products:", data);
  }
}

checkColumns();
