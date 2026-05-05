require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: items } = await supabase.from('inventory_items').select('id, name');
  const { data: stock } = await supabase.from('inventory_stock').select('*');
  const { data: batches } = await supabase.from('inventory_batches').select('*');
  
  console.log('--- ITEMS ---');
  console.log(items);
  console.log('\n--- STOCK ---');
  console.log(stock);
  console.log('\n--- BATCHES ---');
  console.log(batches);
}
run();
