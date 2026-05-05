
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('exec_sql', { query: `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'inventory_batches' 
    AND table_schema = 'public';
  `});
  
  if (error) {
    console.error("Error fetching schema:", error.message);
    // If RPC fails, try a direct query on a known table to see if it works
    const { data: tables, error: tableError } = await supabase.from('inventory_batches').select('*').limit(1);
    console.log("Direct select error (if any):", tableError?.message);
    console.log("Direct select data:", tables);
  } else {
    console.log("Inventory Batches Columns:", data);
  }
}

checkSchema();
