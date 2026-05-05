require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: tx } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false }).limit(10);
  
  console.log('\n--- RECENT TX ---');
  console.log(tx);
}
run();
