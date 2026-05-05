import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load from .env.local as per the other scripts
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Read the migration SQL
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260407180000_update_product_identity.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('--- EXECUTING MIGRATION via Supabase RPC (exec_sql) ---');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
       console.error('RPC Execution Error:', error);
       // Sometimes if it returns nothing but doesn't throw, it might be fine
    } else {
       console.log('Migration Result:', data);
       console.log('Migration Successful!');
    }
  } catch (err) {
    console.error('Execution Failed Exception:', err);
  }
}

run();
