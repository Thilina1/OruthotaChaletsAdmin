const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ysejulbuvunfhodersjr.supabase.co', 'sb_publishable_nn7GsENQXU_YmbYO7S8bUA_s8P4SVW5');
async function test() {
  const { data, error } = await supabase.from('inventory_brands').insert([{ name: 'Test1234' }]);
  console.log('Result:', data, error);
}
test();
