require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: tx } = await supabase.from('inventory_transactions').select('*').eq('item_id', '7c64c8cc-fdc6-42d2-a3f8-0db42124ba4b');
  
  console.log('\n--- TX ---');
  console.log(tx);
}
run();
