import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data } = await supabase.from('inventory_transactions').select('expiry_date').limit(1);
  if (data && data.length > 0) {
    console.log('Transaction Expiry Date:', data[0].expiry_date);
    console.log('Type of value:', typeof data[0].expiry_date);
  }
}
check();
