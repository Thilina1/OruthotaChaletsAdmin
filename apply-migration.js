import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: fs.readFileSync('supabase/migrations/20260228223319_add_completed_status.sql', 'utf8')
    });
    console.log('Result:', data, 'Error:', error);
  } catch (err) {
    console.error('Failed to run migration:', err);
  }
}

run();
