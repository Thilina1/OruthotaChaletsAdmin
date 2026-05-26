require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('get_columns', { table_name: 'purchase_order_items' }).catch(() => ({}));
  if (data) console.log("Columns via RPC:", data);
  
  const { data: cols } = await supabase
    .from('purchase_order_items')
    .select('*')
    .limit(1);
    
  if (cols && cols.length > 0) {
    console.log("Columns from row:", Object.keys(cols[0]));
  } else {
    console.log("No rows found. Cannot infer columns without RPC.");
  }
}
check();
