const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE public.inventory_requests ADD COLUMN IF NOT EXISTS action_metadata JSONB;
    ALTER TABLE public.inventory_requests ADD COLUMN IF NOT EXISTS brand TEXT;
    ALTER TABLE public.inventory_requests ADD COLUMN IF NOT EXISTS supplier_name TEXT;
    ALTER TABLE public.inventory_requests ADD COLUMN IF NOT EXISTS item_size TEXT;
    
    -- Also update the constraint to include TRANSFER_REQUEST if missing
    ALTER TABLE public.inventory_requests DROP CONSTRAINT IF EXISTS inventory_requests_request_type_check;
    ALTER TABLE public.inventory_requests ADD CONSTRAINT inventory_requests_request_type_check 
    CHECK (request_type IN ('NEW_ITEM', 'ADD_STOCK', 'receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock', 'TRANSFER_REQUEST'));
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: sql
    });
    if (error) {
        console.error('Failed to run migration:', error);
        if (error.message.includes('not found')) {
            console.log("\nTIP: It seems the 'exec_sql' RPC is not available. You might need to run the following SQL manually in the Supabase SQL Editor:\n");
            console.log(sql);
        }
    } else {
        console.log('Migration successful:', data);
    }
  } catch (err) {
    console.error('Failed to run migration:', err);
  }
}

run();
