import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: itemData } = await supabase.from('hotel_inventory_items').select('*').limit(1);
  const { data: transData } = await supabase.from('inventory_transactions').select('*').limit(1);
    
  if (itemData && itemData.length > 0) {
    console.log('Item Columns:', Object.keys(itemData[0]));
  }
  if (transData && transData.length > 0) {
    console.log('Transaction Columns:', Object.keys(transData[0]));
  }
}

check();
