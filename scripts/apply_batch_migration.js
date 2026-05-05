import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS batch_number text;`;
  console.log('Running SQL:', sql);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
       console.error('RPC Error:', error);
    } else {
       console.log('Migration Successful:', data);
    }
  } catch (err) {
    console.error('Execution failed:', err);
  }
}

run();
